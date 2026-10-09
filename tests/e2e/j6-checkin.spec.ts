import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { finishOnboard, shot } from './helpers'

/** 从 manifest 推导新用户的第一个阅读任务（章序第一个有手册的章的第 1 节） */
function firstReadingTarget(): { chapterTitle: string; sectionTitle: string } {
  const manifest = JSON.parse(readFileSync('src/generated/manifest.json', 'utf8')) as {
    chapters: Array<{ title: string; sections: Array<{ title: string }> }>
  }
  const ch = manifest.chapters.find((c) => c.sections.length > 0)
  if (!ch) throw new Error('manifest 中没有任何手册小节')
  return { chapterTitle: ch.title, sectionTitle: ch.sections[0].title }
}

test('J6 完成今日任务 → 自动打卡 → 日历连续天数 +1', async ({ page }) => {
  await finishOnboard(page)
  const { chapterTitle, sectionTitle } = firstReadingTarget()

  // 首页应自动生成今日任务（基础阶段：阅读任务）
  await expect(page.getByText('今日任务')).toBeVisible()
  await expect(page.getByText(`阅读《${sectionTitle}》`)).toBeVisible()
  await shot(page, 'j6-01-home-tasks')

  // 完成阅读任务（去手册标已读）。hash 跳转不重载页面，先等渲染再判断展开态：
  // 目标小节已可见（默认展开章）就不点章按钮，否则点章按钮会展开它（重复点会误折叠）
  await page.goto('/#/handbook')
  const sectionBtn = page.getByRole('button', { name: sectionTitle, exact: false })
  const shown = await sectionBtn
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(() => true)
    .catch(() => false)
  if (!shown) {
    await page.getByRole('button', { name: chapterTitle, exact: false }).click()
    await expect(sectionBtn).toBeVisible()
  }
  await sectionBtn.click()
  await expect(page.locator('article.md-body')).toBeVisible()
  await page.getByRole('button', { name: /标记已读/ }).click()
  await expect(page.getByText(/已标记为已读/)).toBeVisible()

  // 回首页：任务打勾 + 连续1天（打卡 toast 可能已消失，用页面状态断言）
  await page.goto('/#/')
  await expect(page.getByText('连续 1 天')).toBeVisible()
  const doneTask = page.getByText(`阅读《${sectionTitle}》`).first()
  await expect(doneTask).toBeVisible()
  await shot(page, 'j6-02-task-done')

  // 日历：统计卡与月份网格
  await page.goto('/#/calendar')
  await expect(page.getByText('连续打卡（天）')).toBeVisible()
  await expect(page.getByText('累计学习（天）')).toBeVisible()
  await expect(page.getByText('完成任意一项当日任务即自动打卡')).toBeVisible()
  await shot(page, 'j6-03-calendar')
})
