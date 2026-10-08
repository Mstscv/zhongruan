import { test, expect } from '@playwright/test'
import { answerCurrent, finishOnboard, shot } from './helpers'

test('J2 章节练习答错 → 错题本 → 重练两次全对 → 自动标已掌握', async ({ page }) => {
  await finishOnboard(page)

  // 题库首页
  await page.goto('/#/quiz')
  await expect(page.getByText('模拟考试')).toBeVisible()
  await shot(page, 'j2-01-quiz-home')

  // 进入第7章配置（默认：练习模式 20题 全部）
  await page.getByRole('button', { name: /项目进度管理/ }).click()
  await expect(page.getByText('本章知识点')).toBeVisible()
  await shot(page, 'j2-02-chapter-config')
  await page.getByRole('button', { name: '开始练习' }).click()

  // 做错一题 → 立即判分 + 解析
  await expect(page.getByTestId('q-stem')).toBeVisible()
  await answerCurrent(page, false)
  await expect(page.getByText('✗ 回答错误')).toBeVisible()
  await expect(page.getByText(/正确答案：[A-D]/)).toBeVisible()
  await shot(page, 'j2-03-wrong-reveal')

  // 中途退出（进度保存）
  await page.getByLabel('退出').click()
  await page.getByRole('button', { name: '退出保存' }).click()
  await expect(page).toHaveURL(/#\/quiz$/)

  // 刷新后回到做题页应能继续（会话恢复）
  await page.goto('/#/quiz/session')
  await expect(page.getByTestId('q-stem')).toBeVisible()
  await page.getByLabel('退出').click()
  await page.getByRole('button', { name: '退出保存' }).click()

  // 错题本：应有 1 道未掌握
  await page.getByRole('button', { name: /错题本/ }).first().click()
  await expect(page.getByTestId('wrong-row')).toHaveCount(1)
  await expect(page.getByText('错 1 次')).toBeVisible()
  await shot(page, 'j2-04-wrongbook')

  // 第 1 次重练：答对
  await page.getByRole('button', { name: /重练这 1 题/ }).click()
  await expect(page.getByTestId('q-stem')).toBeVisible()
  await answerCurrent(page, true)
  await expect(page.getByText('✓ 回答正确')).toBeVisible()
  await page.getByRole('button', { name: '查看结果' }).click()
  await expect(page.getByText('练习小结')).toBeVisible()
  await expect(page.getByText(/答对\s*1\s*\/\s*1/)).toBeVisible()
  await shot(page, 'j2-05-summary')
  await page.getByRole('button', { name: '返回题库' }).click()

  // 第 2 次重练：答对 → 连对2次自动掌握
  await page.goto('/#/quiz/wrong')
  await page.getByRole('button', { name: /重练这 1 题/ }).click()
  await answerCurrent(page, true)
  await expect(page.getByText('✓ 回答正确')).toBeVisible()
  await page.getByRole('button', { name: '查看结果' }).click()
  await page.getByRole('button', { name: '返回题库' }).click()

  // 未掌握清空，已掌握里能看到
  await page.goto('/#/quiz/wrong')
  await expect(page.getByText('没有符合条件的错题')).toBeVisible()
  await page.getByRole('button', { name: /已掌握/ }).click()
  await expect(page.getByTestId('wrong-row')).toHaveCount(1)
  await expect(page.getByText('已掌握').first()).toBeVisible()
  await shot(page, 'j2-06-mastered')
})
