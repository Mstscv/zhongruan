import { describe, expect, it } from 'vitest'
import {
  buildPaper,
  chapterOfQid,
  filterByScope,
  grade,
  mulberry32,
  selectQuestions,
  tierOf,
  type PracticeContext,
} from '@/services/quizEngine'
import type { Question } from '@/types/schema'

function makeQ(n: number, chapter = 'ch07'): Question {
  return {
    id: `Q-${chapter.slice(0, 2).toUpperCase()}-${chapter.slice(2)}-${String(n).padStart(4, '0')}`.replace(
      'CH-',
      'C',
    ),
    chapter,
    topic: '7.1',
    difficulty: ((n % 3) + 1),
    stem: `这是第 ${n} 道题的题干，足够长以通过校验规则要求。`,
    options: ['选项一内容甲', '选项二内容乙', '选项三内容丙', '选项四内容丁'],
    answer: 'ABCD'[n % 4] as 'A' | 'B' | 'C' | 'D',
    explanation: '这是一个足够长的解析：说明为什么正确选项成立，并点出一个干扰项错在哪里。',
    tags: ['测试'],
    source: 'AI 原创模拟',
  }
}

// makeQ 的 id 生成在 chapter='ch07' 时为 Q-CH-07-0001 → 修正为合法格式
function qid(n: number): string {
  return `Q-C07-${String(n).padStart(4, '0')}`
}

function makeQ7(n: number, difficulty = ((n % 3) + 1)): Question {
  return {
    ...makeQ(n),
    id: qid(n),
    difficulty,
  }
}

const emptyCtx = (): PracticeContext => ({ answered: {}, wrongBook: {}, favorites: [] })

describe('mulberry32', () => {
  it('同种子序列可复现', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('值域在 [0,1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 100; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('tierOf', () => {
  it('未做 → 0；未掌握错题 → 1；已做对过 → 2；已掌握错题 → 2', () => {
    const ctx: PracticeContext = {
      answered: {
        [qid(1)]: { correct: 1, wrong: 0 },
        [qid(2)]: { correct: 0, wrong: 2 },
        [qid(3)]: { correct: 2, wrong: 1 },
      },
      wrongBook: { [qid(2)]: { mastered: false }, [qid(3)]: { mastered: true } },
      favorites: [],
    }
    expect(tierOf(qid(9), ctx)).toBe(0)
    expect(tierOf(qid(2), ctx)).toBe(1)
    expect(tierOf(qid(1), ctx)).toBe(2)
    expect(tierOf(qid(3), ctx)).toBe(2)
  })
})

describe('filterByScope', () => {
  const pool = Array.from({ length: 10 }, (_, i) => makeQ7(i + 1))
  const ctx: PracticeContext = {
    answered: { [qid(1)]: { correct: 1, wrong: 0 }, [qid(2)]: { correct: 0, wrong: 1 } },
    wrongBook: { [qid(2)]: { mastered: false } },
    favorites: [qid(3)],
  }
  it('四种范围过滤正确', () => {
    expect(filterByScope(pool, 'all', ctx)).toHaveLength(10)
    expect(filterByScope(pool, 'undone', ctx)).toHaveLength(8)
    expect(filterByScope(pool, 'wrong', ctx).map((q) => q.id)).toEqual([qid(2)])
    expect(filterByScope(pool, 'fav', ctx).map((q) => q.id)).toEqual([qid(3)])
  })
})

describe('selectQuestions', () => {
  const pool = Array.from({ length: 60 }, (_, i) => makeQ7(i + 1))
  it('数量正确且不重复', () => {
    const picked = selectQuestions(pool, 20, emptyCtx(), mulberry32(1))
    expect(picked).toHaveLength(20)
    expect(new Set(picked.map((q) => q.id)).size).toBe(20)
  })
  it('count 超过池子时返回全量打乱', () => {
    const picked = selectQuestions(pool, 999, emptyCtx(), mulberry32(1))
    expect(picked).toHaveLength(60)
  })
  it('优先抽未做题（错题与已做题在未做耗尽前几乎不出现）', () => {
    const ctx: PracticeContext = {
      answered: Object.fromEntries(
        Array.from({ length: 50 }, (_, i) => [qid(i + 11), { correct: 5, wrong: 0 }]),
      ),
      wrongBook: {},
      favorites: [],
    }
    const picked = selectQuestions(pool, 10, ctx, mulberry32(2))
    const undone = picked.filter((q) => Number(q.id.slice(-4)) <= 10)
    expect(undone.length).toBeGreaterThanOrEqual(8)
  })
  it('同种子可复现', () => {
    const a = selectQuestions(pool, 15, emptyCtx(), mulberry32(9))
    const b = selectQuestions(pool, 15, emptyCtx(), mulberry32(9))
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id))
  })
})

describe('grade', () => {
  it('判分正确', () => {
    const q = makeQ7(1)
    q.answer = 'C'
    expect(grade(q, 2)).toBe(true)
    expect(grade(q, 0)).toBe(false)
  })
})

describe('chapterOfQid', () => {
  it('从题号提取章节', () => {
    expect(chapterOfQid('Q-C07-0001')).toBe('ch07')
    expect(chapterOfQid('Q-C13-0142')).toBe('ch13')
  })
})

describe('buildPaper', () => {
  const byChapter = {
    ch07: Array.from({ length: 30 }, (_, i) => ({ ...makeQ7(i + 1), chapter: 'ch07' })),
    ch08: Array.from({ length: 30 }, (_, i) => ({
      ...makeQ7(i + 31),
      id: `Q-C08-${String(i + 1).padStart(4, '0')}`,
      chapter: 'ch08',
      difficulty: ((i % 3) + 1),
    })),
  }
  const weights = { ch07: 6, ch08: 6 }

  it('每章取蓝图数量，无重复，合计正确', () => {
    const paper = buildPaper({ byChapter, weights, recentCorrect: new Set(), rand: mulberry32(5) })
    expect(paper).toHaveLength(12)
    expect(new Set(paper).size).toBe(12)
    expect(paper.filter((id) => id.startsWith('Q-C07')).length).toBe(6)
    expect(paper.filter((id) => id.startsWith('Q-C08')).length).toBe(6)
  })
  it('同种子组卷可复现', () => {
    const a = buildPaper({ byChapter, weights, recentCorrect: new Set(), rand: mulberry32(5) })
    const b = buildPaper({ byChapter, weights, recentCorrect: new Set(), rand: mulberry32(5) })
    expect(a).toEqual(b)
  })
  it('避开近期已答对的题（池子充足时）', () => {
    const recent = new Set(Array.from({ length: 20 }, (_, i) => `Q-C07-${String(i + 1).padStart(4, '0')}`))
    const paper = buildPaper({ byChapter, weights, recentCorrect: recent, rand: mulberry32(6) })
    for (const id of paper) expect(recent.has(id)).toBe(false)
  })
  it('totalCount 缩样到指定题数', () => {
    const paper = buildPaper({
      byChapter,
      weights,
      recentCorrect: new Set(),
      rand: mulberry32(5),
      totalCount: 4,
    })
    expect(paper).toHaveLength(4)
    expect(new Set(paper).size).toBe(4)
  })
})
