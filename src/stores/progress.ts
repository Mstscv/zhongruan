import { defineStore } from 'pinia'
import chaptersMeta from '../../content/meta/chapters.json'
import {
  ProgressSchema,
  type DayTask,
  type MockAttempt,
  type Progress,
  type Question,
} from '@/types/schema'
import { loadJSON, removeKey, saveJSON, saveJSONNow } from './persistence'
import { todayStr, daysBetween, addDays } from '@/utils/date'

export const PROGRESS_KEY = 'ruankao.v1'
const APP_VERSION = '0.1.0'
export const HISTORY_CAP = 2000
export const MOCK_ATTEMPTS_CAP = 50

const examDefaults = chaptersMeta.exam

export function defaultProgress(): Progress {
  const today = todayStr()
  return {
    schemaVersion: 1,
    meta: { appVersion: APP_VERSION, updatedAt: new Date().toISOString() },
    profile: {
      onboarded: false,
      examDate: examDefaults.defaultDate,
      startDate: today,
      dailyMinutes: 60,
      paperMinutes: examDefaults.paperMinutes,
    },
    quiz: { answered: {}, wrongBook: {}, favorites: [], history: [], chapterStats: {} },
    mock: { attempts: [] },
    handbook: { readSections: {}, lastRead: null },
    cases: {},
    checkin: { days: [] },
    plan: { generatedAt: '', signature: '', tasksByDate: {} },
  }
}

function loadProgress(): Progress {
  const loaded = loadJSON(PROGRESS_KEY, ProgressSchema)
  if (loaded) return loaded
  const fresh = defaultProgress()
  saveJSONNow(PROGRESS_KEY, fresh)
  return fresh
}

export const useProgressStore = defineStore('progress', {
  state: () => ({ data: loadProgress() }),

  getters: {
    daysLeft(state): number {
      return daysBetween(state.data.profile.examDate, todayStr())
    },
    /** 连续打卡天数：今天没学则从昨天起算 */
    streak(state): number {
      const set = new Set(state.data.checkin.days)
      if (set.size === 0) return 0
      let cursor = todayStr()
      if (!set.has(cursor)) cursor = addDays(todayStr(), -1) // 昨天
      let n = 0
      while (set.has(cursor)) {
        n++
        cursor = addDays(cursor, -1)
      }
      return n
    },
    totalStudyDays(state): number {
      return state.data.checkin.days.length
    },
  },

  actions: {
    persist() {
      this.data.meta.updatedAt = new Date().toISOString()
      saveJSON(PROGRESS_KEY, this.data)
    },
    persistNow() {
      this.data.meta.updatedAt = new Date().toISOString()
      saveJSONNow(PROGRESS_KEY, this.data)
    },

    setProfile(partial: Partial<Progress['profile']>) {
      Object.assign(this.data.profile, partial)
      this.persist()
    },

    ensureStartDate() {
      if (!this.data.profile.startDate) {
        this.data.profile.startDate = todayStr()
        this.persist()
      }
    },

    /** 记录一次客观题作答；返回是否答错 */
    recordAnswer(q: Question, choice: number, correct: boolean, mode: 'practice' | 'self' | 'mock' | 'wrong'): boolean {
      const now = new Date().toISOString()
      const rec = this.data.quiz.answered[q.id] ?? { correct: 0, wrong: 0, lastAt: now, lastChoice: choice }
      if (correct) rec.correct++
      else rec.wrong++
      rec.lastAt = now
      rec.lastChoice = choice
      this.data.quiz.answered[q.id] = rec

      if (correct) {
        const wb = this.data.quiz.wrongBook[q.id]
        if (wb) {
          wb.correctStreak++
          wb.lastAt = now
          if (wb.correctStreak >= 2) wb.mastered = true
        }
      } else {
        const wb = this.data.quiz.wrongBook[q.id]
        if (wb) {
          wb.wrongCount++
          wb.correctStreak = 0
          wb.lastAt = now
        } else {
          this.data.quiz.wrongBook[q.id] = {
            firstAt: now,
            lastAt: now,
            wrongCount: 1,
            correctStreak: 0,
            mastered: false,
          }
        }
      }

      const cs = this.data.quiz.chapterStats[q.chapter] ?? { attempts: 0, correct: 0 }
      cs.attempts++
      if (correct) cs.correct++
      this.data.quiz.chapterStats[q.chapter] = cs

      this.data.quiz.history.push({ at: now, qid: q.id, correct, mode })
      if (this.data.quiz.history.length > HISTORY_CAP) {
        this.data.quiz.history.splice(0, this.data.quiz.history.length - HISTORY_CAP)
      }
      this.persist()
      return !correct
    },

    /** 错题本重练中"答对到掌握"时手动移出/回炉 */
    setMastered(qid: string, mastered: boolean) {
      const wb = this.data.quiz.wrongBook[qid]
      if (!wb) return
      wb.mastered = mastered
      if (!mastered) wb.correctStreak = 0
      this.persist()
    },
    removeFromWrongBook(qid: string) {
      delete this.data.quiz.wrongBook[qid]
      this.persist()
    },

    toggleFavorite(qid: string) {
      const i = this.data.quiz.favorites.indexOf(qid)
      if (i >= 0) this.data.quiz.favorites.splice(i, 1)
      else this.data.quiz.favorites.push(qid)
      this.persist()
      return i < 0
    },

    markSectionRead(sectionId: string) {
      if (this.data.handbook.readSections[sectionId]) return false
      this.data.handbook.readSections[sectionId] = new Date().toISOString()
      this.data.handbook.lastRead = sectionId
      this.persist()
      return true
    },

    setLastRead(sectionId: string) {
      this.data.handbook.lastRead = sectionId
      this.persist()
    },

    setCaseDraft(caseId: string, subId: string, text: string) {
      const rec =
        this.data.cases[caseId] ?? { level: 'todo' as const, attempts: [], draft: {} }
      rec.draft[subId] = text
      this.data.cases[caseId] = rec
      this.persist()
    },

    recordCaseSelfEval(caseId: string, selfScores: number[]) {
      const rec = this.data.cases[caseId] ?? { level: 'todo' as const, attempts: [], draft: {} }
      rec.attempts.push({ at: new Date().toISOString(), selfScores })
      if (rec.attempts.length > 10) rec.attempts.splice(0, rec.attempts.length - 10)
      rec.level = selfScores.every((s) => s >= 2) ? 'master' : 'fuzzy'
      this.data.cases[caseId] = rec
      this.persist()
    },

    pushMockAttempt(attempt: MockAttempt) {
      this.data.mock.attempts.push(attempt)
      if (this.data.mock.attempts.length > MOCK_ATTEMPTS_CAP) {
        this.data.mock.attempts.splice(0, this.data.mock.attempts.length - MOCK_ATTEMPTS_CAP)
      }
      this.persist()
    },

    addCheckinDay(day = todayStr()) {
      if (!this.data.checkin.days.includes(day)) {
        this.data.checkin.days.push(day)
        this.data.checkin.days.sort()
        this.persist()
        return true
      }
      return false
    },

    /** 计划引擎写入当日任务 */
    setDayTasks(day: string, tasks: DayTask[], signature: string) {
      this.data.plan.tasksByDate[day] = tasks
      this.data.plan.generatedAt = new Date().toISOString()
      this.data.plan.signature = signature
      this.persist()
    },

    /** 从备份整体覆盖（换机恢复） */
    importProgress(progress: Progress) {
      this.data = progress
      this.persistNow()
    },

    clearAll() {
      removeKey(PROGRESS_KEY)
      removeKey('mockSession.v1')
      this.data = defaultProgress()
      this.persistNow()
    },
  },
})

export { chaptersMeta }
