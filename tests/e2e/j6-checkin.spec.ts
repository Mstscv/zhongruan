import { test, expect } from '@playwright/test'
import { finishOnboard, shot } from './helpers'

test('J6 完成今日任务 → 自动打卡 → 日历连续天数 +1', async ({ page }) => {
  await finishOnboard(page)

  // 首页应自动生成今日任务（基础阶段：阅读任务）
  await expect(page.getByText('今日任务')).toBeVisible()
  await expect(page.getByText(/阅读《排列活动顺序》/)).toBeVisible()
  await shot(page, 'j6-01-home-tasks')

  // 完成阅读任务（去手册标已读）
  await page.goto('/#/handbook')
  await page.getByRole('button', { name: /项目进度管理/ }).click()
  await page.getByRole('button', { name: /排列活动顺序/ }).click()
  await expect(page.locator('article.md-body')).toBeVisible()
  await page.getByRole('button', { name: /标记已读/ }).click()
  await expect(page.getByText(/已标记为已读/)).toBeVisible()

  // 回首页：任务打勾 + 连续1天（打卡 toast 可能已消失，用页面状态断言）
  await page.goto('/#/')
  await expect(page.getByText('连续 1 天')).toBeVisible()
  const doneTask = page.getByText(/阅读《排列活动顺序》/).first()
  await expect(doneTask).toBeVisible()
  await shot(page, 'j6-02-task-done')

  // 日历：统计卡与月份网格
  await page.goto('/#/calendar')
  await expect(page.getByText('连续打卡（天）')).toBeVisible()
  await expect(page.getByText('累计学习（天）')).toBeVisible()
  await expect(page.getByText('完成任意一项当日任务即自动打卡')).toBeVisible()
  await shot(page, 'j6-03-calendar')
})
