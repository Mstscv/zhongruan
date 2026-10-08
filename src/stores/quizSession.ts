import { defineStore } from 'pinia'
import type { Question } from '@/types/schema'
import { grade, type SessionMode } from '@/services/quizEngine'
import { emitTaskEvent } from '@/services/events'
import { useProgressStore } from './progress'
import { toast } from '@/composables/toast'

export const QUIZ_SESSION_KEY = 'quizSession.v1'
export const QUIZ_MODES = { practice: '练习模式', self: '自测模式' } as const

export interface QuizSessionState {
  active: boolean
  phase: 'answering' | 'summary'
  mode: SessionMode
  /** 来源标签：'ch07' | 'random' | 'wrong' | 'fav' */
  source: string
  sourceLabel: string
  questions: Question[]
  index: number
  /** qid -> 所选选项下标 */
  choices: Record<string, number>
  /** 练习模式：qid -> 是否已判分 */
  revealed: Record<string, boolean>
  /** qid -> 是否答对 */
  results: Record<string, boolean>
  startedAt: number
  finishedAt: number | null
}

function emptyState(): QuizSessionState {
  return {
    active: false,
    phase: 'answering',
    mode: 'practice',
    source: 'random',
    sourceLabel: '',
    questions: [],
    index: 0,
    choices: {},
    revealed: {},
    results: {},
    startedAt: 0,
    finishedAt: null,
  }
}

function loadState(): QuizSessionState {
  try {
    const raw = window.sessionStorage.getItem(QUIZ_SESSION_KEY)
    if (raw) {
      const s = JSON.parse(raw) as QuizSessionState
      if (s.active && Array.isArray(s.questions) && s.questions.length && s.questions[0].stem) {
        return s
      }
    }
  } catch {
    /* ignore */
  }
  return emptyState()
}

export const useQuizSessionStore = defineStore('quizSession', {
  state: (): QuizSessionState => loadState(),

  getters: {
    current(state): Question | null {
      return state.questions[state.index] ?? null
    },
    answeredCount(state): number {
      return Object.keys(state.choices).length
    },
    correctCount(state): number {
      return Object.values(state.results).filter(Boolean).length
    },
    wrongQuestions(state): Question[] {
      return state.questions.filter((q) => state.results[q.id] === false)
    },
    total(state): number {
      return state.questions.length
    },
  },

  actions: {
    save() {
      try {
        window.sessionStorage.setItem(QUIZ_SESSION_KEY, JSON.stringify(this.$state))
      } catch (e) {
        console.error('[quizSession] 保存失败', e)
      }
    },
    clear() {
      this.$state = emptyState()
      try {
        window.sessionStorage.removeItem(QUIZ_SESSION_KEY)
      } catch {
        /* ignore */
      }
    },

    start(opts: {
      questions: Question[]
      mode: SessionMode
      source: string
      sourceLabel: string
    }) {
      this.$state = {
        ...emptyState(),
        active: true,
        phase: 'answering',
        mode: opts.mode,
        source: opts.source,
        sourceLabel: opts.sourceLabel,
        questions: opts.questions,
        startedAt: Date.now(),
      }
      this.save()
    },

    /** 练习模式：点选项立即判分；自测模式：只记录选择 */
    choose(choice: number) {
      const q = this.current
      if (!q || this.phase !== 'answering') return
      if (this.mode === 'practice' && this.revealed[q.id]) return

      this.choices[q.id] = choice

      if (this.mode === 'practice') {
        const ok = grade(q, choice)
        this.results[q.id] = ok
        this.revealed[q.id] = true
        const progress = useProgressStore()
        const wrong = progress.recordAnswer(q, choice, ok, this.source === 'wrong' ? 'wrong' : 'practice')
        if (wrong) toast('答错了，已加入错题本', 'warn')
        emitTaskEvent({ kind: 'quiz', count: 1, chapter: q.chapter })
        if (this.source === 'wrong') emitTaskEvent({ kind: 'wrong', count: 1 })
      }
      this.save()
    },

    next() {
      if (this.index < this.questions.length - 1) {
        this.index++
        this.save()
      } else {
        this.submit()
      }
    },
    prev() {
      if (this.index > 0) {
        this.index--
        this.save()
      }
    },

    /** 进入小结（练习模式直接结算；自测模式批量判分） */
    submit() {
      if (this.phase === 'summary') return
      if (this.mode === 'self') {
        const progress = useProgressStore()
        let answered = 0
        for (const q of this.questions) {
          const choice = this.choices[q.id]
          if (choice == null) continue
          const ok = grade(q, choice)
          this.results[q.id] = ok
          progress.recordAnswer(q, choice, ok, 'self')
          answered++
        }
        if (answered > 0) emitTaskEvent({ kind: 'quiz', count: answered })
      }
      this.phase = 'summary'
      this.finishedAt = Date.now()
      this.save()
    },
  },
})
