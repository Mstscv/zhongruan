import { test, expect } from '@playwright/test'
import { answerCurrent, finishOnboard, shot } from './helpers'

test('J3 模拟考（25题练习卷）→ 答题卡/标记 → 刷新续考 → 交卷 → 成绩单', async ({ page }) => {
  page.on('dialog', (d) => void d.accept())
  await finishOnboard(page)

  await page.goto('/#/mock/intro')
  await expect(page.getByText('考试规则')).toBeVisible()
  await shot(page, 'j3-01-mock-intro')

  // 选练习卷（25题）并开始
  await page.getByRole('button', { name: /练习卷/ }).click()
  await page.getByRole('button', { name: /开始考试/ }).click()
  await expect(page.getByTestId('q-stem')).toBeVisible({ timeout: 15_000 })
  await shot(page, 'j3-02-mock-exam')

  // 答对前 3 题
  for (let i = 0; i < 3; i++) {
    await answerCurrent(page, true)
    await page.getByRole('button', { name: '下一题' }).click()
  }

  // 答题卡：跳到第 10 题
  await page.getByRole('button', { name: '答题卡' }).click()
  await expect(page.getByRole('button', { name: '25', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '10', exact: true }).click()
  await expect(page.getByText('第 10/25 题')).toBeVisible()

  // 标记本题 + 答一题
  await page.getByRole('button', { name: /标记本题/ }).click()
  await expect(page.getByText('★ 已标记')).toBeVisible()
  await answerCurrent(page, true)
  await shot(page, 'j3-03-mock-marked')

  // J8 续考：刷新后已答数与标记保留，计时继续
  await page.reload()
  await expect(page.getByTestId('q-stem')).toBeVisible()
  await expect(page.getByText(/已答 4/)).toBeVisible()
  await expect(page.getByText('★ 已标记')).toBeVisible()

  // 直接交卷（还有未答 → 原生确认框已自动接受）
  await page.getByRole('button', { name: /交卷/ }).click()
  await expect(page).toHaveURL(/#\/mock\/result/)
  await shot(page, 'j3-04-mock-result')

  // 成绩：4 对（前3题 + 第10题），21 未答 → 4 分
  await expect(page.getByText('4', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('未达合格线')).toBeVisible()
  await expect(page.getByText(/用时 \d+ 分钟/)).toBeVisible()
  // 按章分布与错题解析
  await expect(page.getByText('各章得分率（从弱到强）')).toBeVisible()
  await expect(page.getByText(/错题解析（21 道/)).toBeVisible()
  // 点开一道题看解析（未作答的标注"未作答"）
  await page.getByText('看解析 ▼').first().click()
  await expect(page.getByText(/【考点】/).first()).toBeVisible()
  await expect(page.getByText('未作答').first()).toBeVisible()

  // 历史成绩记录
  await expect(page.getByText(/全部成绩（1 次）/)).toBeVisible()
})
