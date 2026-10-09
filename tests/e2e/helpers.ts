import { type Page, expect } from '@playwright/test'
import { mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const SHOT_DIR = 'tests/e2e/screenshots'
mkdirSync(SHOT_DIR, { recursive: true })

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` })
}

interface BankQ {
  id: string
  stem: string
  answer: string
  options: string[]
}

let bankCache: Map<string, BankQ> | null = null

/** 读取全题库（所有章所有 shard）：stem → 题目（测试里用于算出正确/错误选项） */
export function loadBank(): Map<string, BankQ> {
  if (bankCache) return bankCache
  const map = new Map<string, BankQ>()
  const bankRoot = 'content/bank'
  for (const dir of readdirSync(bankRoot)) {
    const dirPath = join(bankRoot, dir)
    if (!statSync(dirPath).isDirectory()) continue
    for (const file of readdirSync(dirPath)) {
      if (!file.endsWith('.json')) continue
      const arr = JSON.parse(readFileSync(join(dirPath, file), 'utf8')) as BankQ[]
      for (const q of arr) map.set(q.stem, q)
    }
  }
  bankCache = map
  return map
}

/**
 * 回答当前展示的题：correct=true 点正确项，false 点错误项。
 * 通过题干文本反查 ch07 题库。
 */
export async function answerCurrent(page: Page, correct: boolean) {
  const stem = await page.getByTestId('q-stem').innerText()
  const bank = loadBank()
  let q = bank.get(stem)
  if (!q) {
    // 容错：换行/空格差异时按前缀匹配
    const prefix = stem.slice(0, 30)
    for (const [k, v] of bank) {
      if (k.startsWith(prefix) || stem.startsWith(k.slice(0, 30))) {
        q = v
        break
      }
    }
  }
  if (!q) throw new Error(`题库中找不到题干：${stem.slice(0, 50)}`)
  const right = 'ABCD'.indexOf(q.answer)
  const pick = correct ? right : (right + 1) % 4
  await page.getByTestId('option').nth(pick).click()
}

/** 从 manifest 读手册结构（测试断言动态推导，内容增减不破测试） */
export function handbookIndex(): {
  totalSections: number
  chapters: Array<{ id: string; title: string; sections: Array<{ title: string }> }>
} {
  const manifest = JSON.parse(readFileSync('src/generated/manifest.json', 'utf8')) as {
    chapters: Array<{ id: string; title: string; sections: Array<{ title: string }> }>
  }
  return {
    totalSections: manifest.chapters.reduce((n, c) => n + c.sections.length, 0),
    chapters: manifest.chapters,
  }
}

/** 新会话默认空白 localStorage，直接进入引导页 */
export async function gotoOnboard(page: Page) {
  await page.goto('/#/onboard')
  await expect(page.getByRole('heading', { name: /系统集成项目管理工程师/ })).toBeVisible()
}

/** 完成 3 屏引导，落在首页 */
export async function finishOnboard(page: Page) {
  await gotoOnboard(page)
  await page.locator('label input[type=checkbox]').check()
  await page.getByRole('button', { name: '开始设置' }).click()
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '生成我的计划' }).click()
  await expect(page.getByText('距考试还有')).toBeVisible()
}
