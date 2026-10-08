import { defineStore } from 'pinia'
import { MockSessionSchema, type MockSession } from '@/types/schema'
import { loadJSON, saveJSONNow, removeKey } from './persistence'

export const MOCK_SESSION_KEY = 'mockSession.v1'

function loadSession(): MockSession | null {
  return loadJSON(MOCK_SESSION_KEY, MockSessionSchema)
}

export const useMockSessionStore = defineStore('mockSession', {
  state: () => ({ session: loadSession() as MockSession | null }),

  actions: {
    start(opts: { qids: string[]; count: number; minutes: number; seed: number }) {
      this.session = {
        schemaVersion: 1,
        seed: opts.seed,
        qids: opts.qids,
        answers: {},
        marked: [],
        current: 0,
        startAt: new Date().toISOString(),
        endAtEpochMs: Date.now() + opts.minutes * 60_000,
        count: opts.count,
        finished: false,
      }
      this.saveNow()
    },
    saveNow() {
      if (this.session) saveJSONNow(MOCK_SESSION_KEY, this.session)
    },
    answer(qid: string, choice: number) {
      if (!this.session) return
      this.session.answers[qid] = choice
      this.saveNow()
    },
    toggleMark(qid: string) {
      if (!this.session) return
      const i = this.session.marked.indexOf(qid)
      if (i >= 0) this.session.marked.splice(i, 1)
      else this.session.marked.push(qid)
      this.saveNow()
    },
    jump(index: number) {
      if (!this.session) return
      this.session.current = Math.max(0, Math.min(this.session.qids.length - 1, index))
      this.saveNow()
    },
    clear() {
      this.session = null
      removeKey(MOCK_SESSION_KEY)
    },
  },
})
