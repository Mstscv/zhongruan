/**
 * 扫描 content/ 生成 src/generated/manifest.json
 * 运行：npm run gen
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONTENT, ROOT, listDirs, listFiles, readJSON } from './lib/fsutil'
import { BankShardSchema, CaseSchema } from '../src/types/schema'
import type { Manifest, ManifestChapter } from '../src/types/manifest'

interface ChaptersFile {
  version: number
  note: string
  exam: Manifest['exam'] & { note: string }
  chapters: Array<{
    id: string
    no: number
    title: string
    group: string
    note?: string
    bankTarget: number
    caseTarget: number
    topics: Array<{ code: string; title: string }>
  }>
}

interface BlueprintFile {
  version: number
  note: string
  total: number
  difficultyRatio: [number, number, number]
  weights: Record<string, number>
}

function firstHeading(md: string): string | null {
  const m = md.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : null
}

function main() {
  const chaptersFile = readJSON<ChaptersFile>(join(CONTENT, 'meta', 'chapters.json'))
  const blueprint = readJSON<BlueprintFile>(join(CONTENT, 'meta', 'blueprint.json'))

  const errors: string[] = []

  // ── blueprint 校验 ─────────────────────────────
  const weightSum = Object.values(blueprint.weights).reduce((a, b) => a + b, 0)
  if (weightSum !== blueprint.total) {
    errors.push(`blueprint 权重合计 ${weightSum} ≠ total ${blueprint.total}`)
  }
  for (const ch of chaptersFile.chapters) {
    if (blueprint.weights[ch.id] == null) {
      errors.push(`blueprint 缺少章节 ${ch.id} 的权重`)
    }
  }
  for (const key of Object.keys(blueprint.weights)) {
    if (!chaptersFile.chapters.some((c) => c.id === key)) {
      errors.push(`blueprint 含未知章节 ${key}`)
    }
  }

  // ── 扫描每章 ─────────────────────────────────
  const chapters: ManifestChapter[] = chaptersFile.chapters.map((ch) => {
    const chapter: ManifestChapter = {
      id: ch.id,
      no: ch.no,
      title: ch.title,
      group: ch.group,
      ...(ch.note ? { note: ch.note } : {}),
      bankTarget: ch.bankTarget,
      caseTarget: ch.caseTarget,
      topics: ch.topics,
      questionCount: 0,
      shards: [],
      sections: [],
      cases: [],
    }

    // 题片
    const bankDir = join(CONTENT, 'bank', ch.id)
    for (const file of listFiles(bankDir, '.json')) {
      const rel = `bank/${ch.id}/${file}`
      try {
        const arr = readJSON(join(bankDir, file))
        const parsed = BankShardSchema.safeParse(arr)
        if (!parsed.success) {
          errors.push(`${rel}: 格式错误 ${parsed.error.issues[0]?.message}`)
          continue
        }
        chapter.shards.push({ file: rel, count: parsed.data.length })
        chapter.questionCount += parsed.data.length
      } catch (e) {
        errors.push(`${rel}: JSON 解析失败 ${String(e)}`)
      }
    }

    // 手册
    const hbDir = join(CONTENT, 'handbook', ch.id)
    const sectionIds = new Set<string>()
    for (const file of listFiles(hbDir, '.md')) {
      const base = file.replace(/\.md$/, '')
      const segs = base.split('-')
      const rel = `handbook/${ch.id}/${file}`
      if (segs.length < 3 || !/^\d{2}$/.test(segs[0]) || !/^\d{1,2}$/.test(segs[1])) {
        errors.push(`${rel}: 文件名须形如 07-3-标题.md（章号-节号-标题）`)
        continue
      }
      const topicCode = `${ch.no}.${Number(segs[1])}`
      if (!ch.topics.some((t) => t.code === topicCode)) {
        errors.push(`${rel}: 节号 ${topicCode} 不在章节 topics 里`)
        continue
      }
      const id = `${ch.id}--${base}`
      if (sectionIds.has(id)) {
        errors.push(`${rel}: 小节 id 重复 ${id}`)
        continue
      }
      sectionIds.add(id)
      let title: string | null = null
      try {
        const md = readFileSync(join(hbDir, file), 'utf-8')
        title = firstHeading(md)
      } catch (e) {
        errors.push(`${rel}: 读取失败 ${String(e)}`)
        continue
      }
      if (!title) {
        errors.push(`${rel}: 缺少一级标题（# 标题）`)
        continue
      }
      chapter.sections.push({ id, file: rel, title, topic: topicCode })
    }
    chapter.sections.sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true }))

    // 案例
    const caseDir = join(CONTENT, 'cases', ch.id)
    for (const file of listFiles(caseDir, '.json')) {
      const rel = `cases/${ch.id}/${file}`
      try {
        const obj = readJSON(join(caseDir, file))
        const parsed = CaseSchema.safeParse(obj)
        if (!parsed.success) {
          errors.push(`${rel}: 格式错误 ${parsed.error.issues[0]?.path?.join('.')} ${parsed.error.issues[0]?.message}`)
          continue
        }
        if (parsed.data.chapter !== ch.id) {
          errors.push(`${rel}: 案例 chapter=${parsed.data.chapter} 与目录不符`)
          continue
        }
        chapter.cases.push({
          id: parsed.data.id,
          file: rel,
          title: parsed.data.title,
          score: parsed.data.score,
          questionCount: parsed.data.questions.length,
        })
      } catch (e) {
        errors.push(`${rel}: JSON 解析失败 ${String(e)}`)
      }
    }
    return chapter
  })

  // 扫描目录里是否存在未知章节目录
  for (const dir of listDirs(join(CONTENT, 'bank'))) {
    if (!chaptersFile.chapters.some((c) => c.id === dir)) errors.push(`content/bank 存在未知目录 ${dir}`)
  }

  if (errors.length) {
    console.error('✗ gen-manifest 发现错误：')
    for (const e of errors) console.error('  -', e)
    process.exit(1)
  }

  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    disclaimer:
      '本手册与题库由 AI 依据公开知识生成，属练习材料；知识点与考试安排请以《系统集成项目管理工程师教程（第3版）》及官方通知为准。',
    exam: { ...chaptersFile.exam },
    blueprint: {
      total: blueprint.total,
      difficultyRatio: blueprint.difficultyRatio,
      weights: blueprint.weights,
    },
    chapters,
  }

  const out = join(ROOT, 'src', 'generated', 'manifest.json')
  writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')

  const totalQ = chapters.reduce((a, c) => a + c.questionCount, 0)
  const totalS = chapters.reduce((a, c) => a + c.sections.length, 0)
  const totalC = chapters.reduce((a, c) => a + c.cases.length, 0)
  console.log(`✓ manifest 已生成：${chapters.length} 章 / ${totalQ} 题 / ${totalS} 节手册 / ${totalC} 案例`)
}

main()
