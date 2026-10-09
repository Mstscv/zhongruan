import { test, expect } from '@playwright/test'
import { finishOnboard, handbookIndex, shot } from './helpers'

test('J4 手册阅读 → 滚到底自动标已读 → 目录圆点更新', async ({ page }) => {
  await finishOnboard(page)

  // 从 manifest 动态推导：读第7章的最后一节（最后一节按钮是"读完本章"→回目录）
  const { totalSections, chapters } = handbookIndex()
  const ch07 = chapters.find((c) => c.id === 'ch07')!
  const lastTitle = ch07.sections[ch07.sections.length - 1].title

  await page.goto('/#/handbook')
  await expect(page.getByText('知识点手册')).toBeVisible()
  await shot(page, 'j4-01-handbook-index')

  // 展开第7章，进入本章最后一节
  await page.getByRole('button', { name: /项目进度管理/ }).click()
  await page.getByRole('button', { name: lastTitle }).click()
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

  // 从顶部返回目录（底部按钮是全局"下一节"，会跳到其他章，不能用它回目录）
  await page.getByLabel('返回').click()
  await expect(page).toHaveURL(/#\/handbook$/)

  // 目录：第7章 已读 1/N 节 + 全局已读 1/总节数
  await expect(page.getByText(`1/${ch07.sections.length} 节已读`)).toBeVisible()
  await expect(page.getByText(new RegExp(`已读 1/${totalSections} 节`))).toBeVisible()
  await shot(page, 'j4-03-index-after-read')
})
