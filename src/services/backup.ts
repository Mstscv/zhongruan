import { BackupSchema, type Backup, type Progress } from '@/types/schema'
import { todayStr } from '@/utils/date'

export function makeBackup(progress: Progress): Backup {
  return {
    schemaVersion: 1,
    app: 'ruankao-study',
    exportedAt: new Date().toISOString(),
    progress,
  }
}

export function serializeBackup(progress: Progress): string {
  return JSON.stringify(makeBackup(progress), null, 2)
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string }

export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: '不是有效的 JSON 文件' }
  }
  const parsed = BackupSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { ok: false, error: `备份格式不符：${first?.path.join('.') ?? ''} ${first?.message ?? ''}` }
  }
  return { ok: true, backup: parsed.data }
}

/** 触发浏览器下载备份文件 */
export function downloadBackup(progress: Progress) {
  const blob = new Blob([serializeBackup(progress)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `软考备份-${todayStr()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** 读取用户选择的备份文件 */
export function pickBackupFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        reject(new Error('未选择文件'))
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('读取文件失败'))
      reader.readAsText(file, 'utf-8')
    }
    input.click()
  })
}

/** 简单统计，用于导入前预览确认 */
export function summarize(p: Progress) {
  const answered = Object.keys(p.quiz.answered).length
  return {
    answered,
    wrong: Object.keys(p.quiz.wrongBook).length,
    readSections: Object.keys(p.handbook.readSections).length,
    checkinDays: p.checkin.days.length,
    mockAttempts: p.mock.attempts.length,
    cases: Object.keys(p.cases).length,
    examDate: p.profile.examDate,
  }
}
