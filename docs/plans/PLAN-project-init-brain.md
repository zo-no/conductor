# PLAN: 项目初始化 + AI 大脑任务

> 状态: DONE
> 创建时间: 2026-04-16
> 关联需求: 方便初始化项目并启用 AI 大脑

---

## 需求描述

1. `conductor project init` — 交互式 CLI，引导用户设置项目名、目标、工作区，可选启用 AI 大脑
2. `conductor project brain add <projectId>` — 给已有项目补加大脑任务
3. Web UI 创建项目时支持 goal、workDir，以及是否启用大脑
4. 项目设置页加"启用 AI 大脑"入口

---

## 方案设计

### 大脑任务创建逻辑（共用）

抽成 `createBrainTask(projectId)` 函数，放在 `packages/core/src/services/brain.ts`：
- 读取 `packages/core/src/prompts/brain-task.md` 内容作为 prompt
- 调 `createTask` 创建 recurring ai_prompt 任务
- cron: `*/30 * * * *`，assignee: ai，title: "🧠 AI 大脑"

### CLI

`conductor project init`：
- 用 Node.js readline 交互式询问：项目名、目标（可选）、工作区（可选）、是否启用大脑
- 创建项目，如果启用大脑则调 `createBrainTask`

`conductor project brain add <projectId>`：
- 直接调 `createBrainTask(projectId)`

### HTTP API

`POST /projects/:id/brain` — 给已有项目创建大脑任务，Web UI 调用

### Web UI

- `NewProjectDialog.tsx` — 替换原来的 `PromptDialog`，包含：项目名、目标、工作区、启用大脑开关
- `App.tsx` — `handleNewProjectConfirm` 改为接收完整表单数据
- `ProjectSettings.tsx` — 加"启用 AI 大脑"按钮，调 `POST /projects/:id/brain`

---

## 涉及文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/core/src/services/brain.ts` | 新建 | createBrainTask 共用函数 |
| `packages/core/src/controllers/cli/projects.ts` | 修改 | 加 init 和 brain add 命令 |
| `packages/core/src/controllers/http/projects.ts` | 修改 | 加 POST /:id/brain |
| `packages/web-next/components/projects/NewProjectDialog.tsx` | 新建 | 创建项目表单 |
| `packages/web-next/components/App.tsx` | 修改 | 用 NewProjectDialog 替换 PromptDialog |
| `packages/web-next/components/projects/ProjectSettings.tsx` | 修改 | 加启用大脑入口 |

---

## 验收标准

- [ ] `conductor project init` 交互式创建项目，启用大脑后能看到 recurring 任务
- [ ] `conductor project brain add <id>` 给已有项目加大脑任务
- [ ] Web UI 创建项目弹窗有 goal/workDir/大脑开关
- [ ] ProjectSettings 有"启用 AI 大脑"按钮
