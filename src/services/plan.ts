/**
 * 学习计划引擎（纯函数）：阶段划分 + 每日任务生成 + 完成判定。
 * 输入全部显式传入，方便单测；store 接线见 services/bootstrap.ts。
 */
import type { DayTask, Progress } from '@/types/schema'
import { getManifest } from '@/services/contentLoader'
import { addDays, daysBetween, localDateOf, todayStr } from '@/utils/date'
import { chapterOfQid } from '@/services/quizEngine'

export type Phase = 'basic' | 'reinforce' | 'sprint' | 'final'

export const PHASE_META: Record<Phase, { label: string; desc: string; color: string }> = {
  basic: { label: '基础学习', desc: '读手册 + 章节首刷，把知识点过一遍', color: 'var(--color-accent)' },
  reinforce: { label: '强化刷题', desc: '刷题 + 错题回炉，隔天练案例', color: 'var(--color-success)' },
  sprint: { label: '冲刺模拟', desc: '隔天全真模拟考 + 每日案例与错题', color: 'var(--color-danger)' },
  final: { label: '考前调整', desc: '轻量复习，保持状态，别熬夜', color: 'var(--color-warn)' },
}

export function planSignature(profile: Progress['profile']): string {
  return `${profile.examDate}|${profile.dailyMinutes}|${profile.startDate}`
}

/** 当前阶段（按 起始日→考试日 总天数比例划分） */
export function phaseOf(profile: Progress['profile'], date = todayStr()): Phase {
  const total = daysBetween(profile.examDate, profile.startDate)
  if (total <= 0) return 'sprint'
  const elapsed = daysBetween(date, profile.startDate)
  if (elapsed < 0) return 'basic'
  if (elapsed >= total - 2) return 'final'
  const r = elapsed / total
  if (r < 0.5) return 'basic'
  if (r < 0.8) return 'reinforce'
  return 'sprint'
}

export interface PhaseSegment {
  phase: Phase
  from: string
  to: string
}

export function phaseSegments(profile: Progress['profile']): PhaseSegment[] {
  const total = daysBetween(profile.examDate, profile.startDate)
  if (total <= 0) {
    return [{ phase: 'sprint', from: profile.startDate, to: profile.examDate }]
  }
  const endBasic = addDays(profile.startDate, Math.floor(total * 0.5) - 1)
  const endReinforce = addDays(profile.startDate, Math.floor(total * 0.8) - 1)
  const endSprint = addDays(profile.examDate, -3)
  return [
    { phase: 'basic', from: profile.startDate, to: endBasic },
    { phase: 'reinforce', from: addDays(endBasic, 1), to: endReinforce },
    { phase: 'sprint', from: addDays(endReinforce, 1), to: endSprint },
    { phase: 'final', from: addDays(endSprint, 1), to: profile.examDate },
  ]
}

/* ── 每日任务生成 ─────────────────────────────── */

/* ── 当前刷题章节 ── */

/**
 * 在有题的章里选"做题进度最低"的章作为当前刷题章（进度 = 本章已做/题量）。
 * 并列时取章序靠前者。随用户推进自动轮换到下一章，多章上线后不会永远停在第一章。
 */
export function pickCurrentChapter<T extends { id: string; questionCount: number }>(
  chapters: T[],
  progress: Progress,
): T | null {
  const withQ = chapters.filter((c) => c.questionCount > 0)
  if (!withQ.length) return null
  const doneOf = (id: string) =>
    Object.keys(progress.quiz.answered).filter((qid) => chapterOfQid(qid) === id).length
  let best = withQ[0]
  let bestRatio = Infinity
  for (const ch of withQ) {
    const ratio = doneOf(ch.id) / ch.questionCount
    if (ratio < bestRatio) {
      best = ch
      bestRatio = ratio
    }
  }
  return best
}

let seq = 0
function task(
  kind: DayTask['kind'],
  label: string,
  estMin: number,
  target: number,
  extra: Partial<DayTask> = {},
): DayTask {
  return {
    id: `${Date.now()}-${kind}-${seq++}`,
    kind,
    label,
    estMin,
    target,
    done: false,
    ...extra,
  }
}

/**
 * 生成某天的任务清单（调用方负责固化到 plan.tasksByDate）。
 * 规则：按阶段模板取任务，按 dailyMinutes 裁掉尾部（至少保留 1 项）。
 */
export function generateDayTasks(
  profile: Progress['profile'],
  progress: Progress,
  date = todayStr(),
): DayTask[] {
  const manifest = getManifest()
  const phase = phaseOf(profile, date)
  const hasWrong = Object.values(progress.quiz.wrongBook).some((w) => !w.mastered)

  const chapters = manifest.chapters
  const withSections = chapters.filter((c) => c.sections.length > 0)
  const withQuestions = chapters.filter((c) => c.questionCount > 0)
  const withCases = chapters.filter((c) => c.cases.length > 0)

  // 轻量兜底：内容还没上线
  if (!withSections.length && !withQuestions.length) {
    return [task('read', '题库内容生成中，明天再来就有任务啦', 1, 1)]
  }

  const tasks: DayTask[] = []

  if (phase === 'basic') {
    // 读 1~2 节手册（优先没读过的章节，按章序）
    const readCount = profile.dailyMinutes >= 60 ? 2 : 1
    let picked = 0
    for (const ch of withSections) {
      for (const s of ch.sections) {
        if (picked >= readCount) break
        if (progress.handbook.readSections[s.id]) continue
        tasks.push(
          task('read', `阅读《${s.title}》`, readCount > 1 ? 12 : 20, 1, { sectionId: s.id }),
        )
        picked++
      }
      if (picked >= readCount) break
    }
    // 当前刷题章节：按章序取第一个有题的章（后续可按掌握度智能排序）
    const currentCh = pickCurrentChapter(chapters, progress)
    if (currentCh) {
      const n = profile.dailyMinutes >= 90 ? 30 : 20
      tasks.push(task('quiz', `《${currentCh.title}》章节刷题 ${n} 题`, Math.round(n * 1.2), n, { chapter: currentCh.id }))
    }
    if (hasWrong) tasks.push(task('wrong', '错题重练 10 题', 15, 10))
  } else if (phase === 'reinforce') {
    const currentCh = pickCurrentChapter(chapters, progress)
    if (currentCh) {
      tasks.push(task('quiz', `《${currentCh.title}》强化刷题 30 题`, 35, 30, { chapter: currentCh.id }))
    }
    if (hasWrong) tasks.push(task('wrong', '错题重练 15 题', 20, 15))
    const evenDay = daysBetween(date, profile.startDate) % 2 === 0
    if (withCases.length && evenDay) {
      const ch = withCases[0]
      tasks.push(task('case', `案例训练：${ch.cases[0].title}`, 30, 1, { caseId: ch.cases[0].id }))
    }
  } else if (phase === 'sprint') {
    const evenDay = daysBetween(date, profile.startDate) % 2 === 0
    if (evenDay) {
      tasks.push(
        task('mock', `全真模拟考（${manifest.blueprint.total} 题）`, profile.paperMinutes, 1),
      )
    }
    if (hasWrong) tasks.push(task('wrong', '错题重练 20 题', 25, 20))
    if (withCases.length) {
      const ch = withCases[0]
      tasks.push(task('case', `案例训练：${ch.cases[0].title}`, 30, 1, { caseId: ch.cases[0].id }))
    }
    const currentCh = pickCurrentChapter(chapters, progress)
    if (currentCh) {
      tasks.push(task('quiz', `重点章节回炉：《${currentCh.title}》20 题`, 25, 20, { chapter: currentCh.id }))
    }
  } else {
    // final：轻量
    if (hasWrong) tasks.push(task('wrong', '翻翻错题本，看 10 道错题', 15, 10))
    tasks.push(task('read', '浏览手册速记要点，早点休息', 10, 1, { sectionId: withSections[0]?.sections[0]?.id ?? '' }))
  }

  // 按每日时长裁剪尾部（至少保留 1 项；读任务放在最前保证有产出）
  let budget = profile.dailyMinutes
  const kept: DayTask[] = []
  for (const t of tasks) {
    if (kept.length === 0 || budget - t.estMin >= 0) {
      kept.push(t)
      budget -= t.estMin
    }
  }
  return kept
}

/* ── 完成判定（依据当日进度真实计算，不依赖事件顺序） ── */

export function isTaskDone(t: DayTask, progress: Progress, date = todayStr()): boolean {
  switch (t.kind) {
    case 'read':
      return t.sectionId ? !!progress.handbook.readSections[t.sectionId] : false
    case 'quiz': {
      const n = progress.quiz.history.filter(
        (h) =>
          localDateOf(h.at) === date &&
          h.mode !== 'wrong' &&
          (!t.chapter || chapterOfQid(h.qid) === t.chapter),
      ).length
      return n >= t.target
    }
    case 'wrong': {
      const n = progress.quiz.history.filter(
        (h) => localDateOf(h.at) === date && h.mode === 'wrong',
      ).length
      return n >= t.target
    }
    case 'case': {
      if (!t.caseId) return false
      return (progress.cases[t.caseId]?.attempts ?? []).some((a) => localDateOf(a.at) === date)
    }
    case 'mock':
      return progress.mock.attempts.some((a) => localDateOf(a.at) === date)
  }
}

/** 重新计算某日任务的 done 标志 */
export function evaluateTasks(tasks: DayTask[], progress: Progress, date = todayStr()): DayTask[] {
  return tasks.map((t) => (t.done ? t : { ...t, done: isTaskDone(t, progress, date) }))
}
