import { describe, expect, it } from 'vitest'
import {
  generateDayTasks,
  isTaskDone,
  pickCurrentChapter,
  phaseOf,
  phaseSegments,
  PHASE_META,
} from '@/services/plan'
import { defaultProgress } from '@/stores/progress'
import type { DayTask, Progress } from '@/types/schema'
import { todayStr, addDays } from '@/utils/date'

function makeProfile(overrides: Partial<Progress['profile']> = {}): Progress['profile'] {
  return {
    onboarded: true,
    examDate: addDays(todayStr(), 100),
    startDate: todayStr(),
    dailyMinutes: 60,
    paperMinutes: 150,
    ...overrides,
  }
}

describe('phaseOf / phaseSegments', () => {
  it('阶段按起始日→考试日比例划分', () => {
    const start = '2026-01-01'
    const exam = '2026-11-01' // 305 天
    const p = makeProfile({ startDate: start, examDate: exam })
    expect(phaseOf(p, '2026-01-10')).toBe('basic') // 前 50%
    expect(phaseOf(p, '2026-07-20')).toBe('reinforce') // 50%~80%
    expect(phaseOf(p, '2026-10-25')).toBe('sprint') // 80%~末3天
    expect(phaseOf(p, '2026-10-31')).toBe('final') // 最后 3 天
  })

  it('考试日已过 → final；起始日晚于考试日 → sprint', () => {
    const passed = makeProfile({ startDate: '2026-01-01', examDate: '2026-01-02' })
    expect(phaseOf(passed, '2026-06-01')).toBe('final')
    const reversed = makeProfile({ startDate: '2026-06-01', examDate: '2026-01-01' })
    expect(phaseOf(reversed, '2026-06-01')).toBe('sprint')
  })

  it('phaseSegments 首尾相接覆盖全程', () => {
    const p = makeProfile({ startDate: '2026-01-01', examDate: '2026-03-01' })
    const segs = phaseSegments(p)
    expect(segs).toHaveLength(4)
    expect(segs[0].from).toBe('2026-01-01')
    expect(segs[3].to).toBe('2026-03-01')
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].from > segs[i - 1].to || segs[i].from === addDays(segs[i - 1].to, 1)).toBe(true)
    }
    const labels = segs.map((s) => PHASE_META[s.phase].label)
    expect(labels).toEqual(['基础学习', '强化刷题', '冲刺模拟', '考前调整'])
  })
})

describe('pickCurrentChapter 章节轮换', () => {
  const chapters = [
    { id: 'ch01', questionCount: 0 },
    { id: 'ch07', questionCount: 35 },
    { id: 'ch08', questionCount: 40 },
  ]

  it('全部没做过 → 取章序最靠前的有题章', () => {
    const p = defaultProgress()
    expect(pickCurrentChapter(chapters, p)?.id).toBe('ch07')
  })

  it('ch07 做得多之后 → 轮换到进度更低的 ch08', () => {
    const p = defaultProgress()
    for (let i = 0; i < 20; i++) {
      p.quiz.answered[`Q-C07-${String(i + 1).padStart(4, '0')}`] = {
        correct: 1,
        wrong: 0,
        lastAt: new Date().toISOString(),
        lastChoice: 0,
      }
    }
    expect(pickCurrentChapter(chapters, p)?.id).toBe('ch08')
  })

  it('无有题章 → null', () => {
    expect(pickCurrentChapter([{ id: 'ch01', questionCount: 0 }], defaultProgress())).toBeNull()
  })
})

describe('generateDayTasks', () => {
  it('至少保留 1 项任务，且总估时不明显超出 dailyMinutes', () => {
    const p = makeProfile({ dailyMinutes: 30 })
    const progress = defaultProgress()
    const tasks = generateDayTasks(p, progress)
    expect(tasks.length).toBeGreaterThanOrEqual(1)
    // 首项强制保留；其余项受预算约束
    const rest = tasks.slice(1).reduce((a, t) => a + t.estMin, 0)
    expect(rest).toBeLessThanOrEqual(30)
  })

  it('有未掌握错题时生成错题重练任务', () => {
    const p = makeProfile({ dailyMinutes: 120 })
    const progress = defaultProgress()
    progress.quiz.wrongBook['Q-C07-0001'] = {
      firstAt: new Date().toISOString(),
      lastAt: new Date().toISOString(),
      wrongCount: 1,
      correctStreak: 0,
      mastered: false,
    }
    const tasks = generateDayTasks(p, progress)
    expect(tasks.some((t) => t.kind === 'wrong')).toBe(true)
  })
})

describe('isTaskDone 依据进度真实计算', () => {
  const date = todayStr()

  it('read 任务：手册已读即完成', () => {
    const progress = defaultProgress()
    const t: DayTask = { id: 'x', kind: 'read', label: '', estMin: 10, target: 1, sectionId: 'ch07--07-3-排列活动顺序', done: false }
    expect(isTaskDone(t, progress, date)).toBe(false)
    progress.handbook.readSections['ch07--07-3-排列活动顺序'] = new Date().toISOString()
    expect(isTaskDone(t, progress, date)).toBe(true)
  })

  it('quiz 任务：当日同章作答数达标才完成，错题模式不计入', () => {
    const progress = defaultProgress()
    const t: DayTask = { id: 'x', kind: 'quiz', label: '', estMin: 30, target: 3, chapter: 'ch07', done: false }
    const at = new Date().toISOString()
    for (let i = 0; i < 3; i++) {
      progress.quiz.history.push({ at, qid: `Q-C07-000${i + 1}`, correct: true, mode: 'wrong' })
    }
    expect(isTaskDone(t, progress, date)).toBe(false) // wrong 模式不算
    progress.quiz.history[0].mode = 'practice'
    progress.quiz.history[1].mode = 'practice'
    expect(isTaskDone(t, progress, date)).toBe(false) // 只有 2 条
    progress.quiz.history[2].mode = 'practice'
    expect(isTaskDone(t, progress, date)).toBe(true)
  })

  it('mock 任务：当日有模拟考记录即完成', () => {
    const progress = defaultProgress()
    const t: DayTask = { id: 'x', kind: 'mock', label: '', estMin: 150, target: 1, done: false }
    expect(isTaskDone(t, progress, date)).toBe(false)
    progress.mock.attempts.push({
      at: new Date().toISOString(),
      score: 30,
      total: 35,
      durationSec: 600,
      wrongQids: [],
      seed: 1,
      paper: [],
      unanswered: [],
    })
    expect(isTaskDone(t, progress, date)).toBe(true)
  })
})
