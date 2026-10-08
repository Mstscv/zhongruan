import { test, expect } from '@playwright/test'
import { finishOnboard, shot } from './helpers'

test('J5 案例：草稿刷新不丢 → 参考答案 → 三档自评 → 列表变色', async ({ page }) => {
  await finishOnboard(page)

  await page.goto('/#/case')
  await expect(page.getByText('练习方式')).toBeVisible()
  // 唯一案例（第7章）
  await page.locator('button').filter({ hasText: '第 7 章' }).first().click()
  await expect(page.getByText(/问题 1/)).toBeVisible()
  await expect(page.getByText(/项目背景/)).toBeVisible()
  await shot(page, 'j5-01-case-detail')

  // 写草稿 → 刷新 → 草稿还在
  const ta = page.locator('textarea')
  await ta.fill('这是我的作答草稿：SV = EV - PV，进度落后。')
  await expect(ta).toHaveValue('这是我的作答草稿：SV = EV - PV，进度落后。')
  await page.reload()
  await expect(page.locator('textarea')).toHaveValue('这是我的作答草稿：SV = EV - PV，进度落后。')

  // 看参考答案 → 高亮关键词 + 得分点
  await page.getByRole('button', { name: '看参考答案' }).click()
  await expect(page.getByText('参考答案与得分点')).toBeVisible()
  await expect(page.getByText('得分点（对照给自己打分）')).toBeVisible()
  await shot(page, 'j5-02-case-answer')

  // 三问流程：每问先"看参考答案"，再自评"答全了"（点完自动进入下一问）
  const caseQ = await page.locator('section').filter({ hasText: '参考答案' }).count()
  expect(caseQ).toBe(1)
  for (let i = 0; i < 3; i++) {
    const reveal = page.getByRole('button', { name: '看参考答案' })
    if (await reveal.isVisible().catch(() => false)) await reveal.click()
    await page.getByRole('button', { name: /答全了/ }).click()
  }
  await expect(page.getByText(/本题完成 · 标记为「掌握」/)).toBeVisible()
  await shot(page, 'j5-03-case-finished')

  // 列表：状态变"掌握"
  await page.getByRole('button', { name: '返回列表' }).click()
  await expect(page.getByText(/掌握 1/)).toBeVisible()
  await expect(page.getByText('掌握').first()).toBeVisible()
  await shot(page, 'j5-04-case-list-mastered')
})
