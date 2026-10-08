import { z } from 'zod'

/**
 * Zod 单一事实源：题目 / 案例 / 用户进度 / 模拟考会话 / 备份。
 * tools/ 校验脚本与 src/ 应用代码都从这里取 schema 与类型。
 */

export const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD')
export const IsoTime = z.string().min(10)

/* ── 客观题（科目一 单选） ─────────────────────────────── */
export const QuestionSchema = z.object({
  id: z.string().regex(/^Q-C\d{2}-\d{4}$/, '题号格式应为 Q-C07-0001'),
  chapter: z.string().regex(/^ch\d{2}$/),
  topic: z.string().min(1),
  difficulty: z.number().int().min(1).max(3),
  stem: z.string().min(10, '题干至少 10 字'),
  options: z.array(z.string().min(1)).length(4, '必须恰好 4 个选项'),
  answer: z.enum(['A', 'B', 'C', 'D']),
  explanation: z.string().min(40, '解析至少 40 字'),
  tags: z.array(z.string()).default([]),
  source: z.string().default('AI 原创模拟'),
})
export type Question = z.infer<typeof QuestionSchema>

export const BankShardSchema = z.array(QuestionSchema)
export type BankShard = z.infer<typeof BankShardSchema>

/* ── 案例题（科目二） ─────────────────────────────────── */
export const CaseSubQuestionSchema = z.object({
  id: z.string().min(1),
  score: z.number().int().min(1),
  prompt: z.string().min(5),
  answer: z.string().min(5),
  keywords: z.array(z.string()).min(1),
  scoringPoints: z.array(z.string()).min(1),
})
export type CaseSubQuestion = z.infer<typeof CaseSubQuestionSchema>

export const CaseSchema = z.object({
  id: z.string().regex(/^CASE-\d{5}$/),
  chapter: z.string().regex(/^ch\d{2}$/),
  title: z.string().min(4),
  score: z.number().int().min(1),
  scenario: z.string().min(50),
  questions: z.array(CaseSubQuestionSchema).min(2, '案例至少 2 问'),
  referenceAnswer: z.string().min(20),
  level1Hint: z.string().default(''),
})
export type Case = z.infer<typeof CaseSchema>

/* ── 每日任务 / 进度 ──────────────────────────────────── */
export const TaskKindSchema = z.enum(['read', 'quiz', 'wrong', 'case', 'mock'])

export const DayTaskSchema = z.object({
  id: z.string(),
  kind: TaskKindSchema,
  label: z.string(),
  estMin: z.number().min(1),
  target: z.number().min(1),
  chapter: z.string().optional(),
  sectionId: z.string().optional(),
  done: z.boolean(),
})
export type DayTask = z.infer<typeof DayTaskSchema>

export const AnswerRecordSchema = z.object({
  correct: z.number().int().min(0),
  wrong: z.number().int().min(0),
  lastAt: IsoTime,
  lastChoice: z.number().int().min(0).max(3),
})

export const WrongRecordSchema = z.object({
  firstAt: IsoTime,
  lastAt: IsoTime,
  wrongCount: z.number().int().min(1),
  correctStreak: z.number().int().min(0),
  mastered: z.boolean(),
})

export const HistoryEntrySchema = z.object({
  at: IsoTime,
  qid: z.string(),
  correct: z.boolean(),
  mode: z.enum(['practice', 'self', 'mock', 'wrong']),
})

export const MockAttemptSchema = z.object({
  at: IsoTime,
  score: z.number().int().min(0),
  total: z.number().int().min(1),
  durationSec: z.number().int().min(0),
  wrongQids: z.array(z.string()),
  seed: z.number().int(),
})
export type MockAttempt = z.infer<typeof MockAttemptSchema>

export const CaseRecordSchema = z.object({
  level: z.enum(['todo', 'fuzzy', 'master']),
  attempts: z.array(
    z.object({
      at: IsoTime,
      selfScores: z.array(z.number().int().min(0).max(2)),
    }),
  ),
  draft: z.record(z.string(), z.string()),
})

export const ProgressSchema = z.object({
  schemaVersion: z.literal(1),
  meta: z.object({ appVersion: z.string(), updatedAt: IsoTime }),
  profile: z.object({
    onboarded: z.boolean(),
    examDate: DateStr,
    startDate: DateStr,
    dailyMinutes: z.number().int().min(10).max(300),
    paperMinutes: z.number().int().min(5).max(400),
  }),
  quiz: z.object({
    answered: z.record(z.string(), AnswerRecordSchema),
    wrongBook: z.record(z.string(), WrongRecordSchema),
    favorites: z.array(z.string()),
    history: z.array(HistoryEntrySchema),
    chapterStats: z.record(z.string(), z.object({ attempts: z.number(), correct: z.number() })),
  }),
  mock: z.object({ attempts: z.array(MockAttemptSchema) }),
  handbook: z.object({
    readSections: z.record(z.string(), IsoTime),
    lastRead: z.string().nullable(),
  }),
  cases: z.record(z.string(), CaseRecordSchema),
  checkin: z.object({ days: z.array(DateStr) }),
  plan: z.object({
    generatedAt: z.string(),
    signature: z.string(),
    tasksByDate: z.record(z.string(), z.array(DayTaskSchema)),
  }),
})
export type Progress = z.infer<typeof ProgressSchema>

/* ── 模拟考进行中会话（单独 localStorage 键） ─────────── */
export const MockSessionSchema = z.object({
  schemaVersion: z.literal(1),
  seed: z.number().int(),
  qids: z.array(z.string()).min(1),
  answers: z.record(z.string(), z.number().int().min(0).max(3)),
  marked: z.array(z.string()),
  current: z.number().int().min(0),
  startAt: IsoTime,
  endAtEpochMs: z.number().int(),
  count: z.number().int().min(1),
  finished: z.boolean(),
})
export type MockSession = z.infer<typeof MockSessionSchema>

/* ── 备份文件 ─────────────────────────────────────────── */
export const BackupSchema = z.object({
  schemaVersion: z.literal(1),
  app: z.string(),
  exportedAt: IsoTime,
  progress: ProgressSchema,
})
export type Backup = z.infer<typeof BackupSchema>
