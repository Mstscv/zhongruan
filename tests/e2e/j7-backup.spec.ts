import { test, expect } from '@playwright/test'
import { finishOnboard, handbookIndex, shot } from './helpers'

test('J7 导出备份 → 清空数据 → 导入恢复全部进度', async ({ page }) => {
  await finishOnboard(page)

  // 造一点数据：读一节手册
  await page.goto('/#/handbook')
  await page.getByRole('button', { name: /项目进度管理/ }).click()
  await page.getByRole('button', { name: /排列活动顺序/ }).click()
  await page.getByRole('button', { name: /标记已读/ }).click()
  await expect(page.getByText(/已标记为已读/)).toBeVisible()

  // 导出备份（截获下载）
  await page.goto('/#/me')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /导出备份/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^软考备份-\d{4}-\d{2}-\d{2}\.json$/)
  const backupPath = await download.path()
  expect(backupPath).toBeTruthy()
  await shot(page, 'j7-01-export')

  // 清空全部数据（两步确认）
  await page.getByRole('button', { name: '清空全部学习数据' }).click()
  await page.getByRole('button', { name: '确认清空' }).click()
  await expect(page.getByText('已清空全部学习数据')).toBeVisible()

  // 已清空 → 首页被守卫送回引导页
  await page.goto('/#/')
  await expect(page).toHaveURL(/#\/onboard/)

  // 回到"我的"导入备份（清空后仍可访问路由——直接 goto；守卫会拦截…改用导入入口前先看守卫）
  // 说明：守卫把非引导页都拦走，因此在引导页状态下无法进"我的"。
  // 通过先完成引导（新空白进度），再导入覆盖恢复。
  await page.locator('label input[type=checkbox]').check()
  await page.getByRole('button', { name: '开始设置' }).click()
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '生成我的计划' }).click()
  await expect(page.getByText('距考试还有')).toBeVisible()

  // 导入备份
  await page.goto('/#/me')
  const fileChooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /导入备份/ }).click()
  const fc = await fileChooser
  await fc.setFiles(backupPath!)
  await expect(page.getByText('确认恢复备份？')).toBeVisible()
  await shot(page, 'j7-02-import-preview')
  await page.getByRole('button', { name: '确认覆盖恢复' }).click()
  await expect(page.getByText(/备份已恢复/)).toBeVisible()

  // 恢复验证：手册已读 1 节回来了（全局进度从 manifest 动态推导）
  await page.goto('/#/handbook')
  await expect(page.getByText(new RegExp(`已读 1/${handbookIndex().totalSections} 节`))).toBeVisible()
  await shot(page, 'j7-03-restored')
})
