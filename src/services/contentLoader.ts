import type { Case, Question } from '@/types/schema'
import manifestData from '@/generated/manifest.json'
import type { Manifest } from '@/types/manifest'

const manifest = manifestData as unknown as Manifest

/* 按需加载：每个章节的题片 / 每个手册文件 / 每个案例文件各自独立 chunk */
const bankModules = import.meta.glob('/content/bank/*/*.json', {
  import: 'default',
}) as Record<string, () => Promise<Question[]>>
const sectionModules = import.meta.glob('/content/handbook/*/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>
const caseModules = import.meta.glob('/content/cases/*/*.json', {
  import: 'default',
}) as Record<string, () => Promise<Case>>

const bankCache = new Map<string, Question[]>()
const caseCache = new Map<string, Case>()

export function getManifest(): Manifest {
  return manifest
}

export function listChapters() {
  return manifest.chapters
}

export function getChapter(chapterId: string) {
  return manifest.chapters.find((c) => c.id === chapterId)
}

/** 加载某章全部题目（该章所有 shard 合并，约 40~120 题 / 数十 KB） */
export async function loadChapterQuestions(chapterId: string): Promise<Question[]> {
  const cached = bankCache.get(chapterId)
  if (cached) return cached
  const chapter = getChapter(chapterId)
  if (!chapter) throw new Error(`未知章节 ${chapterId}`)
  const shards = await Promise.all(
    chapter.shards.map(async (s) => {
      const loader = bankModules[`/content/${s.file}`]
      if (!loader) throw new Error(`题片缺失：${s.file}`)
      return loader()
    }),
  )
  const all = shards.flat()
  bankCache.set(chapterId, all)
  return all
}

/** 按题号取题（错题本/收藏夹/模拟考成绩页用，跨章） */
export async function loadQuestionsByChapterIds(chapterIds: string[]): Promise<Question[]> {
  const lists = await Promise.all(chapterIds.map((id) => loadChapterQuestions(id)))
  return lists.flat()
}

export async function loadQuestionMap(qids: string[]): Promise<Map<string, Question>> {
  const chapterIds = [...new Set(qids.map((q) => q.slice(3, 5)).map((n) => `ch${n}`))]
  const all = await loadQuestionsByChapterIds(chapterIds)
  const map = new Map(all.map((q) => [q.id, q]))
  return map
}

export async function loadSection(sectionId: string): Promise<string> {
  const chapterId = sectionId.split('--')[0]
  const chapter = getChapter(chapterId)
  const info = chapter?.sections.find((s) => s.id === sectionId)
  if (!info) throw new Error(`小节缺失：${sectionId}`)
  const loader = sectionModules[`/content/${info.file}`]
  if (!loader) throw new Error(`小节文件缺失：${info.file}`)
  return loader()
}

export async function loadCase(caseId: string): Promise<Case> {
  const cached = caseCache.get(caseId)
  if (cached) return cached
  let file: string | undefined
  for (const c of manifest.chapters) {
    const hit = c.cases.find((x) => x.id === caseId)
    if (hit) {
      file = hit.file
      break
    }
  }
  if (!file) throw new Error(`案例缺失：${caseId}`)
  const loader = caseModules[`/content/${file}`]
  if (!loader) throw new Error(`案例文件缺失：${file}`)
  const data = await loader()
  caseCache.set(caseId, data)
  return data
}

/** 某章的下一节（章节内按文件名排序），没有则返回 null */
export function nextSection(sectionId: string): { id: string; title: string } | null {
  const chapterId = sectionId.split('--')[0]
  const chapter = getChapter(chapterId)
  if (!chapter) return null
  const idx = chapter.sections.findIndex((s) => s.id === sectionId)
  if (idx < 0) return null
  if (idx < chapter.sections.length - 1) {
    const s = chapter.sections[idx + 1]
    return { id: s.id, title: s.title }
  }
  // 跨章到下一章第一节
  const cIdx = manifest.chapters.findIndex((c) => c.id === chapterId)
  const nextChapter = manifest.chapters[cIdx + 1]
  const first = nextChapter?.sections[0]
  return first ? { id: first.id, title: first.title } : null
}
