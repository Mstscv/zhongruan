/**
 * 部署到 Gitee Pages：build → 把 dist/ 产物强推到 pages 分支。
 * 用法：npm run deploy（跳过构建：npm run deploy -- --skip-build）
 * 分支策略：main = 源码；pages = 仅构建产物（每次孤儿提交强推，历史无意义）。
 */
import { execSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const skipBuild = process.argv.includes('--skip-build')

function sh(cmd: string, cwd = ROOT) {
  console.log(`  $ ${cmd}`)
  return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim()
}

function main() {
  if (!skipBuild) {
    console.log('── 构建 ──')
    sh('npm run build')
  }

  const dist = join(ROOT, 'dist')
  const remote = sh('git remote get-url origin')
  console.log(`\n── 发布 dist/ → ${remote} (pages) ──`)

  const tmp = mkdtempSync(join(tmpdir(), 'ruanzhong-pages-'))
  try {
    cpSync(dist, tmp, { recursive: true })
    // Gitee Pages 从分支根目录取静态文件；无渲染处理需求，标记即可
    writeFileSync(join(tmp, '.nojekyll'), '')

    sh('git init -b pages', tmp)
    sh('git remote add origin ' + remote, tmp)
    sh('git add -A', tmp)
    sh('git -c user.name="ruanzhong-deploy" -c user.email="deploy@local" commit -m "deploy: 更新站点"', tmp)
    sh('git push -f origin pages', tmp)

    console.log('\n✓ 已推送 pages 分支')
    console.log('下一步（仅首次）：Gitee 网页端 → 仓库 → 服务 → Gitee Pages → 选择 pages 分支 / 根目录 → 启动')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

main()
