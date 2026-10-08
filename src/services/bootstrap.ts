/**
 * 订线：把学习事件 → 当日任务完成判定 → 自动打卡 串起来。
 * main.ts 在 pinia 安装后调用 initTaskEngine。
 */
import type { useProgressStore } from '@/stores/progress'
import { onTaskEvent } from './events'
import { evaluateTasks, generateDayTasks, planSignature } from './plan'
import { todayStr } from '@/utils/date'
import { toast } from '@/composables/toast'

type Store = ReturnType<typeof useProgressStore>

/** 确保今天有任务（首次打开当天 / 设置变更后重新生成），并结算已完成项 */
export function ensureTodayTasks(store: Store): void {
  if (!store.data.profile.onboarded) return
  const sig = planSignature(store.data.profile)
  const today = todayStr()
  const existing = store.data.plan.tasksByDate[today]
  if (!existing || store.data.plan.signature !== sig) {
    const tasks = generateDayTasks(store.data.profile, store.data, today)
    store.setDayTasks(today, tasks, sig)
  }
  refreshTodayTasks(store)
}

/** 依据真实进度重算今日任务 done 标志；任一完成 → 自动打卡 */
export function refreshTodayTasks(store: Store): void {
  const today = todayStr()
  const tasks = store.data.plan.tasksByDate[today]
  if (!tasks) return
  if (!tasks.some((t) => !t.done)) return

  const evaluated = evaluateTasks(tasks, store.data, today)
  const changed = evaluated.some((t, i) => t.done !== tasks[i].done)
  if (!changed) return

  store.setDayTasks(today, evaluated, store.data.plan.signature)
  if (evaluated.some((t) => t.done)) {
    const added = store.addCheckinDay(today)
    if (added) {
      window.setTimeout(() => {
        toast(`今日已打卡 · 连续 ${store.streak} 天 🔥`, 'success')
      }, 300)
    }
  }
}

export function initTaskEngine(store: Store): void {
  ensureTodayTasks(store)
  onTaskEvent(() => {
    ensureTodayTasks(store)
  })
}
