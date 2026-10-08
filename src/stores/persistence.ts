import type { z } from 'zod'

/**
 * 持久化适配层：当前只有 localStorage；未来接云同步时新增 remoteAdapter
 * 并 setAdapter() 即可，业务代码不感知。
 */
export interface Adapter {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export const localAdapter: Adapter = {
  get: (key) => {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (key, value) => {
    try {
      window.localStorage.setItem(key, value)
    } catch (e) {
      console.error('[persistence] 保存失败', key, e)
    }
  },
  remove: (key) => {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}

let adapter: Adapter = localAdapter

export function setAdapter(next: Adapter) {
  adapter = next
}

export function loadJSON<T>(key: string, schema: z.ZodType<T>): T | null {
  const raw = adapter.get(key)
  if (raw == null) return null
  try {
    const parsed = schema.safeParse(JSON.parse(raw))
    if (parsed.success) return parsed.data
    console.error(`[persistence] ${key} 数据校验失败，已备份到 ${key}.corrupt`, parsed.error.issues)
    adapter.set(`${key}.corrupt`, raw)
    adapter.remove(key)
    return null
  } catch {
    console.error(`[persistence] ${key} JSON 解析失败，已备份到 ${key}.corrupt`)
    adapter.set(`${key}.corrupt`, raw)
    adapter.remove(key)
    return null
  }
}

/** 防抖保存（默认 800ms）；页面隐藏/关闭时立即落盘，防移动端杀后台丢数据。 */
const pending = new Map<string, { value: string; timer: number }>()

export function saveJSON(key: string, value: unknown, debounceMs = 800) {
  const raw = JSON.stringify(value)
  const prev = pending.get(key)
  if (prev) window.clearTimeout(prev.timer)
  const timer = window.setTimeout(() => {
    pending.delete(key)
    adapter.set(key, raw)
  }, debounceMs)
  pending.set(key, { value: raw, timer })
}

/** 立即保存（模拟考会话等场景每答一题调用，不做防抖）。 */
export function saveJSONNow(key: string, value: unknown) {
  const prev = pending.get(key)
  if (prev) window.clearTimeout(prev.timer)
  pending.delete(key)
  adapter.set(key, JSON.stringify(value))
}

export function flushAll() {
  for (const [key, entry] of pending) {
    window.clearTimeout(entry.timer)
    adapter.set(key, entry.value)
  }
  pending.clear()
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })
  window.addEventListener('pagehide', flushAll)
}

export function removeKey(key: string) {
  const prev = pending.get(key)
  if (prev) window.clearTimeout(prev.timer)
  pending.delete(key)
  adapter.remove(key)
}

export function storageSize(key: string): number {
  return (adapter.get(key) ?? '').length
}
