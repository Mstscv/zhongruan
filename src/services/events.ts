/**
 * 学习事件总线：做题/阅读/案例/模拟考等动作发出事件，
 * 计划引擎（services/plan.ts）订阅事件来判定当日任务完成并触发打卡。
 */
export type TaskEvent =
  | { kind: 'read'; sectionId: string }
  | { kind: 'quiz'; count: number; chapter?: string }
  | { kind: 'wrong'; count: number }
  | { kind: 'case'; caseId: string }
  | { kind: 'mock'; score: number; total: number }

type Listener = (e: TaskEvent) => void

const listeners = new Set<Listener>()

export function onTaskEvent(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emitTaskEvent(e: TaskEvent) {
  for (const fn of [...listeners]) {
    try {
      fn(e)
    } catch (err) {
      console.error('[events] 监听器异常', err)
    }
  }
}
