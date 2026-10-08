/**
 * 内容质量门：任一 error 即退出码 1（npm run validate）。
 * 校验范围：章节骨架 / blueprint / 客观题 / 案例 / 手册。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONTENT, listDirs, listFiles, readJSON } from './lib/fsutil'
import { CaseSchema, QuestionSchema } from '../src/types/schema'

interface ChaptersFile {
  exam: { paperQuestions: number }
  chapters: Array<{
    id: string
    no: number
    title: string
    bankTarget: number
    caseTarget: number
    topics: Array<{ code: string; title: string }>
  }>
}

interface BlueprintFile {
  total: number
  weights: Record<string, number>
  difficultyRatio: [number, number, number]
}

const BANNED_IN_STEM = ['正确答案', '本题答案', '答案是']

function normalize(s: string): string {
  return s.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase()
}

function main() {
  const errors: string[] = []
  const warnings: string[] = []
  const err = (m: string) => errors.push(m)
  const warn = (m: string) => warnings.push(m)

  const chaptersFile = readJSON<ChaptersFile>(join(CONTENT, 'meta', 'chapters.json'))
  const blueprint = readJSON<BlueprintFile>(join(CONTENT, 'meta', 'blueprint.json'))
  const chapterById = new Map(chaptersFile.chapters.map((c) => [c.id, c]))

  // ── 骨架 ─────────────────────────────────────
  const ids = new Set<string>()
  for (const ch of chaptersFile.chapters) {
    if (ids.has(ch.id)) err(`章节 id 重复：${ch.id}`)
    ids.add(ch.id)
    const codes = new Set<string>()
    for (const t of ch.topics) {
      if (codes.has(t.code)) err(`${ch.id} 知识点编号重复：${t.code}`)
      codes.add(t.code)
    }
  }

  // ── blueprint ───────────────────────────────
  const weightSum = Object.values(blueprint.weights).reduce((a, b) => a + b, 0)
  if (weightSum !== blueprint.total) err(`blueprint 权重合计 ${weightSum} ≠ ${blueprint.total}`)
  if (blueprint.total !== chaptersFile.exam.paperQuestions) {
    warn(`blueprint.total=${blueprint.total} 与 exam.paperQuestions=${chaptersFile.exam.paperQuestions} 不一致`)
  }
  for (const ch of chaptersFile.chapters) {
    if (blueprint.weights[ch.id] == null) err(`blueprint 缺少 ${ch.id}`)
  }

  // ── 客观题 ─────────────────────────────────
  const allIds = new Set<string>()
  const stemSeen = new Map<string, string>() // normalized stem -> qid
  const perChapter = new Map<string, { n: number; d: number[] }>()

  const bankRoot = join(CONTENT, 'bank')
  for (const dir of listDirs(bankRoot)) {
    if (!chapterById.has(dir)) {
      err(`content/bank/${dir} 不是已知章节`)
      continue
    }
    for (const file of listFiles(join(bankRoot, dir), '.json')) {
      const rel = `bank/${dir}/${file}`
      let arr: unknown
      try {
        arr = readJSON(join(bankRoot, dir, file))
      } catch (e) {
        err(`${rel}: JSON 解析失败`)
        continue
      }
      if (!Array.isArray(arr)) {
        err(`${rel}: 顶层必须是题目数组`)
        continue
      }
      const stat = perChapter.get(dir) ?? { n: 0, d: [0, 0, 0] }
      arr.forEach((raw, i) => {
        const label = `${rel}[${i}]`
        const parsed = QuestionSchema.safeParse(raw)
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            err(`${label}: ${issue.path.join('.')} ${issue.message}`)
          }
          return
        }
        const q = parsed.data
        if (q.chapter !== dir) err(`${label}: 章节 ${q.chapter} 与目录 ${dir} 不符`)
        if (q.id.slice(3, 5) !== dir.slice(2)) err(`${label}: 题号 ${q.id} 与目录 ${dir} 不符`)
        if (allIds.has(q.id)) err(`${label}: 题号重复 ${q.id}`)
        allIds.add(q.id)

        // 选项
        if (new Set(q.options).size !== 4) err(`${label}: 选项不互异`)
        for (const opt of q.options) {
          if (opt.length > 60) warn(`${label}: 选项过长(${opt.length}字) ${opt.slice(0, 20)}…`)
        }

        // 泄题检查
        for (const w of BANNED_IN_STEM) {
          if (q.stem.includes(w)) err(`${label}: 题干含泄题字样「${w}」`)
        }
        if (/^[A-D]\s*[.、]/.test(q.stem)) warn(`${label}: 题干疑似直接带选项编号`)

        // 归一化去重（全局）
        const key = normalize(q.stem)
        const dup = stemSeen.get(key)
        if (dup && dup !== q.id) err(`${label}: 与 ${dup} 题干重复`)
        else stemSeen.set(key, q.id)

        // 干扰项长度悬殊
        const lens = q.options.map((o) => o.length)
        if (Math.max(...lens) > 3 * Math.min(...lens) && Math.min(...lens) >= 6) {
          warn(`${label}: 选项长度悬殊，疑似凑数`)
        }

        stat.n++
        stat.d[q.difficulty - 1]++
        perChapter.set(dir, stat)
      })
    }
  }

  // ── 章节完成度 / 难度分布 ───────────────────
  const status: string[] = []
  for (const ch of chaptersFile.chapters) {
    const s = perChapter.get(ch.id) ?? { n: 0, d: [0, 0, 0] }
    const need = Math.ceil(ch.bankTarget * 0.9)
    const done = s.n >= need
    const hard = s.n > 0 ? s.d[2] / s.n : 0
    if (s.n > 0 && hard < 0.1) warn(`${ch.id}: 难度3占比 ${(hard * 100).toFixed(0)}% < 10%`)
    status.push(
      `${ch.id} ${ch.title.padEnd(12, '　')} 题 ${String(s.n).padStart(4)}/${ch.bankTarget}` +
        `（完成线 ${need}${done ? ' ✓' : ''}） 难度1/2/3=${s.d.join('/')} 案例 ${ch.caseTarget} 目标`,
    )
  }

  // ── 案例 ───────────────────────────────────
  const caseIds = new Set<string>()
  const casesRoot = join(CONTENT, 'cases')
  const caseCountByChapter = new Map<string, number>()
  for (const dir of listDirs(casesRoot)) {
    if (!chapterById.has(dir)) {
      err(`content/cases/${dir} 不是已知章节`)
      continue
    }
    for (const file of listFiles(join(casesRoot, dir), '.json')) {
      const rel = `cases/${dir}/${file}`
      let raw: unknown
      try {
        raw = readJSON(join(casesRoot, dir, file))
      } catch {
        err(`${rel}: JSON 解析失败`)
        continue
      }
      const parsed = CaseSchema.safeParse(raw)
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          err(`${rel}: ${issue.path.join('.')} ${issue.message}`)
        }
        continue
      }
      const c = parsed.data
      if (c.chapter !== dir) err(`${rel}: chapter=${c.chapter} 与目录 ${dir} 不符`)
      if (c.id.slice(6, 8) !== dir.slice(2)) err(`${rel}: 案例号 ${c.id} 与目录 ${dir} 不符`)
      if (caseIds.has(c.id)) err(`${rel}: 案例号重复 ${c.id}`)
      caseIds.add(c.id)
      const sum = c.questions.reduce((a, q) => a + q.score, 0)
      if (sum !== c.score) warn(`${rel}: 各问分值合计 ${sum} ≠ 总分 ${c.score}`)
      caseCountByChapter.set(dir, (caseCountByChapter.get(dir) ?? 0) + 1)
    }
  }

  // ── 手册 ───────────────────────────────────
  for (const dir of listDirs(join(CONTENT, 'handbook'))) {
    const ch = chapterById.get(dir)
    if (!ch) {
      err(`content/handbook/${dir} 不是已知章节`)
      continue
    }
    const files = listFiles(join(CONTENT, 'handbook', dir), '.md')
    if (files.length === 0) warn(`${dir}: 手册还没有任何小节`)
    for (const file of files) {
      const base = file.replace(/\.md$/, '')
      const segs = base.split('-')
      if (segs.length < 3 || !/^\d{2}$/.test(segs[0]) || !/^\d{1,2}$/.test(segs[1])) {
        err(`handbook/${dir}/${file}: 文件名须形如 07-3-标题.md`)
        continue
      }
      const topicCode = `${ch.no}.${Number(segs[1])}`
      if (!ch.topics.some((t) => t.code === topicCode)) {
        err(`handbook/${dir}/${file}: 节号 ${topicCode} 不在 topics 里`)
      }
      const md = readJSONSafe(join(CONTENT, 'handbook', dir, file))
      if (md !== null && !/^#\s+/m.test(md)) err(`handbook/${dir}/${file}: 缺少一级标题`)
    }
  }

  // ── 输出 ───────────────────────────────────
  console.log('── 章节状态 ─────────────────────────────')
  for (const line of status) console.log(line)
  const totalQ = [...perChapter.values()].reduce((a, s) => a + s.n, 0)
  const totalC = [...caseCountByChapter.values()].reduce((a, n) => a + n, 0)
  console.log(`\n合计：客观题 ${totalQ} 道，案例 ${totalC} 道`)

  if (warnings.length) {
    console.log(`\n⚠ 警告 ${warnings.length} 条：`)
    for (const w of warnings.slice(0, 50)) console.log('  -', w)
    if (warnings.length > 50) console.log(`  …另有 ${warnings.length - 50} 条`)
  }
  if (errors.length) {
    console.error(`\n✗ 错误 ${errors.length} 条：`)
    for (const e of errors.slice(0, 80)) console.error('  -', e)
    if (errors.length > 80) console.error(`  …另有 ${errors.length - 80} 条`)
    process.exit(1)
  }
  console.log('\n✓ validate 通过')
}

function readJSONSafe(p: string): string | null {
  try {
    return readFileSync(p, 'utf-8')
  } catch {
    return null
  }
}

main()
