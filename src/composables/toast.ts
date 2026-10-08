import { ref } from 'vue'

export interface ToastItem {
  id: number
  msg: string
  type: 'info' | 'success' | 'warn'
}

export const toasts = ref<ToastItem[]>([])

let seq = 0

export function toast(msg: string, type: ToastItem['type'] = 'info', duration = 2400) {
  const id = ++seq
  toasts.value.push({ id, msg, type })
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, duration)
}
