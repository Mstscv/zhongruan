import { type Page, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'

export const SHOT_DIR = 'tests/e2e/screenshots'
mkdirSync(SHOT_DIR, { recursive: true })

export async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` })
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
