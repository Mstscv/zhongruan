/**
 * 内容质量门：任一 error 即退出码 1（npm run validate）。
 * 校验范围：章节骨架 / blueprint / 客观题 / 案例 / 手册。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONTENT, listDirs, listFiles, readJSON } from './lib/fsutil'
import { type Question, CaseSchema, QuestionSchema } from '../src/types/schema'

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
      const fileQs: Question[] = []
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
          if (/^[A-D]\s*[.、]/.test(opt)) err(`${label}: 选项文本含编号前缀（UI 会自动加）`)
        }

        // 泄题检查
        for (const w of BANNED_IN_STEM) {
          if (q.stem.includes(w)) err(`${label}: 题干含泄题字样「${w}」`)
        }
        if (/^[A-D]\s*[.、]/.test(q.stem)) warn(`${label}: 题干疑似直接带选项编号`)

        // 题干/解析长度（规范 §1）
        if (q.stem.length > 80) err(`${label}: 题干 ${q.stem.length} 字，超过 80 字上限`)
        if (q.explanation.length < 60 || q.explanation.length > 150) {
          warn(`${label}: 解析 ${q.explanation.length} 字，规范要求 60–150 字`)
        }

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
        fileQs.push(q)
        perChapter.set(dir, stat)
      })

      // ── 片级风格规则（规范 §1：答案分布 / 连续模式 / 难度比）──
      if (fileQs.length >= 10) {
        const cnt: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
        for (const q of fileQs) cnt[q.answer]++
        for (const [L, n] of Object.entries(cnt)) {
          const r = n / fileQs.length
          if (r < 0.2 || r > 0.3) {
            err(`${rel}: 答案 ${L} 占 ${(r * 100).toFixed(0)}%（${n}/${fileQs.length}），超出 20%–30%`)
          }
        }
        let run = 1
        for (let i = 1; i < fileQs.length; i++) {
          run = fileQs[i].answer === fileQs[i - 1].answer ? run + 1 : 1
          if (run >= 3) {
            err(`${rel}: 第 ${i + 1} 题起连续 3 个相同答案 ${fileQs[i].answer}`)
            break
          }
        }
        const allOrNone = fileQs.filter((q) =>
          q.options.some((o) => /以上都对|以上都不对|都正确|都不正确/.test(o)),
        ).length
        if (allOrNone > 1) err(`${rel}: "以上都对/都不对"类选项 ${allOrNone} 题，全片限 1 题`)

        const d3 = fileQs.filter((q) => q.difficulty === 3).length / fileQs.length
        const d1 = fileQs.filter((q) => q.difficulty === 1).length / fileQs.length
        if (d3 < 0.1) warn(`${rel}: 难度3 占 ${(d3 * 100).toFixed(0)}% < 10%`)
        if (d1 < 0.2 || d1 > 0.4) warn(`${rel}: 难度1 占 ${(d1 * 100).toFixed(0)}%，偏离 3:5:2 约 30%`)
      }
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
  const caseHintChecks: Array<{ rel: string; chapter: string; hint: string }> = []
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
      if (c.scenario.length < 200 || c.scenario.length > 400) {
        warn(`${rel}: 背景 ${c.scenario.length} 字，规范要求 200–400 字`)
      }
      if (c.level1Hint) caseHintChecks.push({ rel, chapter: dir, hint: c.level1Hint })
      caseCountByChapter.set(dir, (caseCountByChapter.get(dir) ?? 0) + 1)
    }
  }

  // ── 手册 ───────────────────────────────────
  const handbookTopicsByChapter = new Map<string, Set<number>>()
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
      } else {
        const set = handbookTopicsByChapter.get(dir) ?? new Set<number>()
        set.add(Number(segs[1]))
        handbookTopicsByChapter.set(dir, set)
      }
      const md = readJSONSafe(join(CONTENT, 'handbook', dir, file))
      if (md !== null && !/^#\s+/m.test(md)) err(`handbook/${dir}/${file}: 缺少一级标题`)
      if (md !== null) {
        const plainLen = md.replace(/\s/g, '').length
        if (plainLen < 700 || plainLen > 1600) {
          warn(`handbook/${dir}/${file}: 正文约 ${plainLen} 字，规范模板要求 800–1500 字`)
        }
        // CommonMark 坑：** 内侧紧贴括号 → 加粗失效、字面 ** 漏出
        // 只匹配实测会渲染失败的形态（**X**（Y）/ **X**： 等正常形式不报）
        const lines = md.split('\n')
        lines.forEach((line, li) => {
          const brokenPair = /\S\*\*[（(][^*]+[)）]\*\*/.test(line) // 用**（内容）**描述
          const brokenClose = /[)）]\*\*[A-Za-z一-龥]/.test(line) // ）**后面直接跟文字
          if (brokenPair || brokenClose) {
            warn(`handbook/${dir}/${file}:${li + 1}: 加粗内侧贴括号，会渲染失效（把括号移到 ** 外面）`)
          }
        })
      }
    }
  }

  // ── 案例 level1Hint 指向的手册节须存在 ─────
  for (const c of caseHintChecks) {
    const m = c.hint.match(/(\d+)\s*[.．]\s*(\d+)/)
    if (!m) continue
    const code = `${Number(m[1])}.${Number(m[2])}`
    const ch = chapterById.get(c.chapter)
    if (!ch || !ch.topics.some((t) => t.code === code)) {
      warn(`${c.rel}: level1Hint 提到的 ${code} 不是本章知识点`)
    } else if (!handbookTopicsByChapter.get(c.chapter)?.has(Number(m[2]))) {
      warn(`${c.rel}: level1Hint 指向的手册 ${code} 节还不存在`)
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
