# 软考备考站（ruanzhong)

针对**软考·系统集成项目管理工程师（第 3 版大纲）**的纯前端备考应用：刷题、错题本、模拟考、手册阅读、案例训练、学习计划与打卡，全部数据存 localStorage，**无需后端**。

## 快速开始

```bash
npm install
npm run dev        # 开发服务器 http://localhost:5173
```

| 命令 | 说明 |
|---|---|
| `npm run build` | 常规构建 → `dist/`（部署到任意静态托管） |
| `npm run build:single` | 离线单文件 → `dist-single/`（全部资源内联，双击 index.html 即用） |
| `npm run typecheck` | vue-tsc 类型检查 |
| `npm run test` | Vitest 单元测试（抽题组卷、计划引擎） |
| `npm run test:e2e` | Playwright 端到端（7 条用户旅程，移动端 390×844） |
| `npm run validate` | 内容校验（题库/手册/案例，**报错必须修**） |
| `npm run gen` | 由 `content/` 重新生成 `src/generated/manifest.json` |
| `npm run stats` | 各章题量/难度/解析质量统计 |

## 架构

```
content/          手写内容（题库 JSON / 手册 Markdown / 案例 JSON / 章节元数据）
   │  npm run validate —— Zod + 风格规则校验（报错不许绕过）
   │  npm run gen      —— 生成清单
   ▼
src/generated/manifest.json   构建期生成的章节/题量/蓝图清单
   ▼
src/services/     纯函数核心：quizEngine（种子化抽题组卷）、plan（四阶段计划）、
                  contentLoader（按章分块懒加载）、backup
   ▼
src/stores/       Pinia：progress（localStorage 持久化，Zod 载入校验 + 脏数据 .corrupt 备份）
   ▼
src/views/        22 个页面（hash 路由，可部署任意静态路径 / file:// 打开）
```

关键约定：

- **Zod 单一事实源**：`src/types/schema.ts` 同时供应用运行时与 `tools/` 校验脚本使用。
- **内容规范**：`docs/内容生成规范.md`；每批内容 `validate → gen → commit → content/CHANGELOG.md` 记一行。
- **合格线按卷面换算**：`src/utils/score.ts`，题量不足 75 时（练习卷/试产期）按 60% 等比判定。
- **日期一律本地时区**：`src/utils/date.ts` 的 `todayStr/localDateOf`，禁止直接对 ISO 串 `slice(0,10)`。

## 目录速览

- `content/bank|handbook|cases/` — 按章内容（**全量已满额**：19 章共 1630 题 + 83 节手册 + 39 案例，每章题量 = bankTarget）
- `docs/内容生成规范.md` — 内容生产规范（题干/选项/解析/分布的机器可执行规则）
- `tests/unit/` — 引擎与计划纯函数测试；`tests/e2e/` — Playwright 旅程 + 截图
- `tools/` — validate / gen-manifest / stats 脚本（tsx 直跑 TS）

## 免责声明

题库与手册为 AI 依据公开知识生成的练习材料；知识点、考试日期与合格线（当前为占位值）请以《系统集成项目管理工程师教程（第 3 版）》及官方通知为准。
