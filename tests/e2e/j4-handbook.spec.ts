import { test, expect } from '@playwright/test'
import { finishOnboard, shot } from './helpers'

test('J4 手册阅读 → 滚到底自动标已读 → 目录圆点更新', async ({ page }) => {
  await finishOnboard(page)

  await page.goto('/#/handbook')
  await expect(page.getByText('知识点手册')).toBeVisible()
  await shot(page, 'j4-01-handbook-index')

  // 展开第7章（默认展开第一章/最近阅读章），进入唯一小节
  await page.getByRole('button', { name: /项目进度管理/ }).click()
  await page.getByRole('button', { name: /排列活动顺序/ }).click()
  await expect(page.locator('article.md-body')).toBeVisible()
  await expect(page.getByText('未读')).toBeVisible()
  // 正文有实质内容
  const len = (await page.locator('article.md-body').innerText()).length
  expect(len).toBeGreaterThan(500)
  await shot(page, 'j4-02-reader')

  // 滚到底 → 3 秒后自动标已读
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(page.getByText(/已读完本节，自动标记/)).toBeVisible({ timeout: 6_000 })
  await expect(page.getByText('已读').first()).toBeVisible()

  // 底部按钮（本章最后一节 → 读完手册）点击回目录
  await page.getByRole('button', { name: /读完本章|下一节/ }).click()
  await expect(page).toHaveURL(/#\/handbook$/)

  // 目录：第7章 1/1 节已读 + 总进度 1/1
  await expect(page.getByText('1/1 节已读')).toBeVisible()
  await expect(page.getByText(/已读 1\/1 节/)).toBeVisible()
  await shot(page, 'j4-03-index-after-read')
})
