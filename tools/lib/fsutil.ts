import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const TOOLS_DIR = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(TOOLS_DIR, '..', '..')
export const CONTENT = join(ROOT, 'content')

export function readJSON<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

export function exists(path: string): boolean {
  return existsSync(path)
}

/** 列出目录下匹配后缀的文件名（不含路径），按文件名自然排序 */
export function listFiles(dir: string, suffix: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(suffix) && statSync(join(dir, f)).isFile())
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

export function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => statSync(join(dir, f)).isDirectory())
    .sort()
}
