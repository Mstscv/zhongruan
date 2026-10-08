import { test, expect } from '@playwright/test'
import { finishOnboard, gotoOnboard, shot } from './helpers'

test('J1 首次打开 → 三屏引导 → 首页出现倒计时', async ({ page }) => {
  // 打开根路径应被守卫送到引导页
  await page.goto('/')
  await expect(page).toHaveURL(/#\/onboard/)
  await shot(page, 'j1-01-onboard-step1')

  // 未勾选同意时按钮禁用
  const startBtn = page.getByRole('button', { name: '开始设置' })
  await expect(startBtn).toBeDisabled()

  await gotoOnboard(page)
  await page.locator('label input[type=checkbox]').check()
  await shot(page, 'j1-02-onboard-agreed')
  await startBtn.click()

  // 第2屏：默认 2027年5月
  await expect(page.getByRole('heading', { name: '你打算哪次考试？' })).toBeVisible()
  await shot(page, 'j1-03-onboard-date')
  await page.getByRole('button', { name: '下一步' }).click()

  // 第3屏：时长选择
  await expect(page.getByRole('heading', { name: '每天能学多久？' })).toBeVisible()
  await page.getByRole('button', { name: /1.5小时/ }).click()
  await shot(page, 'j1-04-onboard-minutes')
  await page.getByRole('button', { name: '生成我的计划' }).click()

  // 落在首页，倒计时存在
  await expect(page.getByText('距考试还有')).toBeVisible()
  await expect(page.getByText(/2027-05/)).toBeVisible()
  await shot(page, 'j1-05-home')

  // 刷新后仍是登录状态（onboarded 已持久化）
  await page.reload()
  await expect(page).toHaveURL(/#\//)
  await expect(page.getByText('距考试还有')).toBeVisible()
})

test('J1b 已完成引导的用户不会再进引导页', async ({ page }) => {
  await finishOnboard(page)
  await page.goto('/#/onboard')
  await expect(page).toHaveURL(/#\//)
})
