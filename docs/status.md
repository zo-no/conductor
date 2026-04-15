# 实现状态

> 本文档对照设计文档和代码，记录每个功能点的实现状态。
> 状态：✅ 已实现 | 🟡 部分实现 | ❌ 未实现

---

## 数据模型

### Project

| 字段 | 设计 | 实现 | 状态 |
|------|------|------|------|
| id（`proj_` + hex） | data-model.md | `models/projects.ts` | ✅ |
| name | data-model.md | `models/projects.ts` | ✅ |
| goal（可选） | data-model.md | `models/projects.ts` | ✅ |
| workDir | data-model.md | `models/projects.ts` | ✅ |
| systemPrompt（可选） | data-model.md | `database-schema.md` → `projects.system_prompt` | ✅ |
| archived | data-model.md | `models/projects.ts` | ✅ |
| 默认项目"日常事务" | architecture.md | 未见自动创建逻辑 | ❌ |
| 日常事务不可删除/改名/归档 | architecture.md | 未见保护逻辑 | ❌ |

### Task

| 字段/特性 | 设计 | 实现 | 状态 |
|-----------|------|------|------|
| assignee（human/ai） | data-model.md | `tasks` 表 | ✅ |
| kind（once/scheduled/recurring） | data-model.md | `tasks` 表 | ✅ |
| status（pending/running/done/failed/cancelled/blocked） | data-model.md | `tasks` 表 | ✅ |
| scheduleConfig（JSON） | data-model.md | `tasks.schedule_config` | ✅ |
| executor（kind + config） | data-model.md | `tasks.executor_kind` + `executor_config` | ✅ |
| executorOptions（includeLastOutput/customVars/reviewOnComplete） | data-model.md | `tasks.executor_options` | ✅ |
| dependsOn | data-model.md | `tasks.depends_on` | ✅ |
| waitingInstructions | data-model.md | `tasks.waiting_instructions` | ✅ |
| sourceTaskId | data-model.md | `tasks.source_task_id` | ✅ |
| blockedByTaskId | data-model.md | `tasks.blocked_by_task_id` | ✅ |
| completionOutput | data-model.md | `tasks.completion_output` | ✅ |
| enabled | data-model.md | `tasks.enabled` | ✅ |
| createdBy（human/ai） | data-model.md | `tasks.created_by` | ✅ |
| orderIndex | database-schema.md | `tasks.order_index` | ✅ |

### TaskLog

| 特性 | 设计 | 实现 | 状态 |
|------|------|------|------|
| 保留最近 50 条 | data-model.md | `models/task-logs.ts` 有 limit，但未见 50 条清理逻辑 | 🟡 |
| 任务删除时级联删除 | data-model.md | `ON DELETE CASCADE` | ✅ |
| triggeredBy（manual/scheduler/api/cli） | data-model.md | `tasks.triggered_by` | ✅ |
| output 截断至 64KB | database-schema.md | 未见截断逻辑 | ❌ |

### TaskOp

| 特性 | 设计 | 实现 | 状态 |
|------|------|------|------|
| 永久保留（不级联删除） | data-model.md | 无 `ON DELETE CASCADE` | ✅ |
| op 类型完整性 | data-model.md | `createTaskOp` 调用处覆盖大多数 op 类型 | ✅ |

### TaskRun / TaskRunSpool

| 特性 | 设计 | 实现 | 状态 |
|------|------|------|------|
| task_runs 表 | database-schema.md | `models/task-runs.ts` | ✅ |
| task_run_spool 表 | database-schema.md | `models/task-runs.ts` | ✅ |
| 逐行输出 + SSE 推送 | database-schema.md | `executor.ts` → `appendSpoolLine` + `emit(run_line)` | ✅ |

---

## CLI

### task 命令

| 命令 | 设计 | 实现 | 状态 |
|------|------|------|------|
| `task list` | cli-api.md | `controllers/cli/tasks.ts` | ✅ |
| `task get <id>` | cli-api.md | `controllers/cli/tasks.ts` | ✅ |
| `task logs <id>` | cli-api.md | `controllers/cli/tasks.ts` | ✅ |
| `task ops <id>` | cli-api.md | `controllers/cli/tasks.ts` | ✅ |
| `task create`（AI 任务完整参数） | cli-api.md | `controllers/cli/tasks.ts` | ✅ |
| `task create`（人类任务 `--instructions` / `--source-task`） | cli-api.md | `controllers/cli/tasks.ts` | ✅ |
| `task update <id>` | cli-api.md | `controllers/cli/tasks.ts` | ✅ |
| `task delete <id>` | cli-api.md | `controllers/cli/tasks.ts` | ✅ |
| `task run <id>` | cli-api.md | `controllers/cli/tasks.ts` | ✅ |
| `task done <id> [--output]` | cli-api.md | `controllers/cli/tasks.ts` | ✅ |
| `task cancel <id>` | cli-api.md | `controllers/cli/tasks.ts` | ✅ |
| `--json` 输出所有命令 | cli-api.md | `controllers/cli/output.ts` | ✅ |

### project 命令

| 命令 | 设计 | 实现 | 状态 |
|------|------|------|------|
| `project list` | cli-api.md | `controllers/cli/projects.ts` | ✅ |
| `project get <id>` | cli-api.md | `controllers/cli/projects.ts` | ✅ |
| `project create` | cli-api.md | `controllers/cli/projects.ts` | ✅ |
| `project update <id>` | cli-api.md | `controllers/cli/projects.ts` | ✅ |
| `project delete <id>` | cli-api.md | `controllers/cli/projects.ts` | ✅ |
| `project archive <id>` | cli-api.md | `controllers/cli/projects.ts` | ✅ |
| `project unarchive <id>` | cli-api.md | `controllers/cli/projects.ts` | ✅ |

### prompt 命令

| 命令 | 设计 | 实现 | 状态 |
|------|------|------|------|
| `prompt get [--project]` | cli-api.md | `controllers/cli/prompts.ts` | ✅ |
| `prompt set "<content>" [--project]` | cli-api.md | `controllers/cli/prompts.ts` | ✅ |
| `prompt delete [--project]` | cli-api.md | `controllers/cli/prompts.ts` | ✅ |

### daemon 命令

| 命令 | 设计 | 实现 | 状态 |
|------|------|------|------|
| `daemon start` | cli-api.md | 未见 daemon 子命令 | ❌ |
| `daemon status` | cli-api.md | 未见 daemon 子命令 | ❌ |
| `version` | cli-api.md | 未确认 | 🟡 |
| `info [--json]` | cli-api.md | 未确认 | 🟡 |

---

## HTTP API

### Projects

| 端点 | 设计 | 实现 | 状态 |
|------|------|------|------|
| `GET /api/projects` | cli-api.md | `controllers/http/projects.ts` | ✅ |
| `POST /api/projects` | cli-api.md | `controllers/http/projects.ts` | ✅ |
| `GET /api/projects/:id` | cli-api.md | `controllers/http/projects.ts` | ✅ |
| `PATCH /api/projects/:id` | cli-api.md | `controllers/http/projects.ts` | ✅ |
| `DELETE /api/projects/:id` | cli-api.md | `controllers/http/projects.ts` | ✅ |
| `POST /api/projects/:id/archive` | cli-api.md | `controllers/http/projects.ts` | ✅ |
| `POST /api/projects/:id/unarchive` | cli-api.md | `controllers/http/projects.ts` | ✅ |

### Tasks

| 端点 | 设计 | 实现 | 状态 |
|------|------|------|------|
| `GET /api/tasks` | cli-api.md | `controllers/http/tasks.ts` | ✅ |
| `POST /api/tasks` | cli-api.md | `controllers/http/tasks.ts` | ✅ |
| `GET /api/tasks/:id` | cli-api.md | `controllers/http/tasks.ts` | ✅ |
| `PATCH /api/tasks/:id` | cli-api.md | `controllers/http/tasks.ts` | ✅ |
| `DELETE /api/tasks/:id` | cli-api.md | `controllers/http/tasks.ts` | ✅ |
| `POST /api/tasks/:id/run` | cli-api.md | `controllers/http/tasks.ts` | ✅ |
| `POST /api/tasks/:id/done` | cli-api.md | `controllers/http/tasks.ts` | ✅ |
| `POST /api/tasks/:id/cancel` | cli-api.md | `controllers/http/tasks.ts` | ✅ |
| `GET /api/tasks/:id/logs` | cli-api.md | `controllers/http/tasks.ts` | ✅ |
| `GET /api/tasks/:id/ops` | cli-api.md | `controllers/http/tasks.ts` | ✅ |
| `GET /api/tasks/:id/runs` | cli-api.md | `controllers/http/runs.ts` | ✅ |
| `GET /api/tasks/:id/runs/:runId/spool` | cli-api.md | `controllers/http/runs.ts` | ✅ |

### Prompts

| 端点 | 设计 | 实现 | 状态 |
|------|------|------|------|
| `GET /api/prompts/system` | cli-api.md | `controllers/http/prompts.ts` | ✅ |
| `PATCH /api/prompts/system` | cli-api.md | `controllers/http/prompts.ts` | ✅ |
| `GET /api/prompts/project/:id` | cli-api.md | `controllers/http/prompts.ts` | ✅ |
| `PATCH /api/prompts/project/:id` | cli-api.md | `controllers/http/prompts.ts` | ✅ |
| `DELETE /api/prompts/project/:id` | cli-api.md | `controllers/http/prompts.ts` | ✅ |

### Events（SSE）

| 特性 | 设计 | 实现 | 状态 |
|------|------|------|------|
| `GET /api/events` | cli-api.md | `controllers/http/events.ts` | ✅ |
| `?projectId=` 过滤 | cli-api.md | `controllers/http/events.ts` | ✅ |
| 事件类型：connected/task_created/task_updated/task_deleted | cli-api.md | `services/events.ts` | ✅ |
| 事件类型：run_line（含 taskId/runId/line/ts） | cli-api.md | `executor.ts` → `emit(run_line)` | ✅ |

---

## 执行模型

### 提示词三层架构

| 特性 | 设计 | 实现 | 状态 |
|------|------|------|------|
| 系统级 prompt → 项目级 prompt → 任务级 prompt 顺序组装 | execution-model.md | `executor.ts:buildSystemPromptAppend` | ✅ |
| 占位符统一替换 | execution-model.md | `executor.ts:interpolate` | ✅ |

### 占位符

| 占位符 | 设计 | 实现 | 状态 |
|--------|------|------|------|
| `{date}` | execution-model.md | `executor.ts:buildVars` | ✅ |
| `{datetime}` | execution-model.md | `executor.ts:buildVars` | ✅ |
| `{taskTitle}` | execution-model.md | `executor.ts:buildVars` | ✅ |
| `{taskDescription}` | execution-model.md | `executor.ts:buildVars` | ✅ |
| `{projectName}` | execution-model.md | `executor.ts:buildVars` | ✅ |
| `{lastOutput}` | execution-model.md | `executor.ts:buildVars` → `completionOutput` 字段 | 🟡 注1 |
| 自定义 `{key}`（customVars） | execution-model.md | `executor.ts:buildVars` | ✅ |

> 注1：`{lastOutput}` 当前注入的是 `completionOutput`（人类任务完成输出），不是上次 AI 执行结果。设计中 `includeLastOutput=true` 应注入上次 task_logs 的 output，实现有偏差。

### 调度器

| 特性 | 设计 | 实现 | 状态 |
|------|------|------|------|
| scheduled 任务到时触发一次，完成后 status=done | execution-model.md | `scheduler.ts` | ✅ |
| recurring 任务按 cron 触发，更新 lastRunAt/nextRunAt | execution-model.md | `scheduler.ts` | ✅ |
| 错过处理：不补跑，记录 skipped | execution-model.md | `scheduler.ts` | ✅ |
| 重启后不回头触发 | execution-model.md | reconcile 只重置 running→pending | ✅ |
| 并发保护：上次还在 running 则跳过 | execution-model.md | `scheduler.ts:runningTasks` Set | ✅ |
| dependsOn：前置未 done 则跳过 | execution-model.md | `scheduler.ts` | ✅ |
| 启动顺序：initDb → reconcile → startScheduler → startServer | execution-model.md | `server.ts` | ✅ |
| reconcile：running → pending + 写 task_ops | execution-model.md | `scheduler.ts:reconcile` | ✅ |

### 执行器

| 特性 | 设计 | 实现 | 状态 |
|------|------|------|------|
| script executor | execution-model.md | `executor.ts:executeScript` | ✅ |
| ai_prompt executor（claude CLI） | execution-model.md | `executor.ts:executeAiPrompt` | ✅ |
| http executor | execution-model.md | `executor.ts:executeHttp` | ✅ |
| 超时 300s + SIGTERM + 15s grace + SIGKILL | execution-model.md | `executor.ts` | ✅ |
| reviewOnComplete：执行完创建 human review 任务 | execution-model.md | `scheduler.ts` 中有实现 | ✅ |

### 等待任务 Callback 流转

| 步骤 | 设计 | 实现 | 状态 |
|------|------|------|------|
| AI 创建 human 任务 + 自身 blocked | execution-model.md | CLI `task create --source-task` | ✅ |
| 人类完成任务后自动解除 AI 任务 blocked | execution-model.md | `tasks.ts:done` + HTTP `tasks.ts:/done` | ✅ |
| 解除后自动重新触发 AI 任务 | execution-model.md | `void executeTask(bt.id)` / `void runTask(...)` | ✅ |
| completionOutput 注入 AI 任务上下文 | execution-model.md | `updateTask(bt.id, { completionOutput })` | ✅ |

---

## Web UI

### 整体布局

| 特性 | 设计 | 实现 | 状态 |
|------|------|------|------|
| PC 三栏：项目列表 + 时间线 + 任务编辑侧边栏 | ui-design.md | `App.tsx` | ✅ |
| 移动端：横向项目 tab + human/AI tab + 时间线 | ui-design.md | `App.tsx:MobileLayout` | ✅ |
| 任务编辑从右侧滑出，不遮挡时间线 | ui-design.md | `TaskDetail.tsx`（固定宽度 drawer） | ✅ |
| 未选中任务时右侧为空 | ui-design.md | `App.tsx` 条件渲染 | ✅ |

### 时间线分区

| 特性 | 设计 | 实现 | 状态 |
|------|------|------|------|
| 今天 / 明天 / 未来日期分区 | ui-design.md | `Timeline.tsx` | 🟡 需确认 |
| 周期任务折叠区 | ui-design.md | `Timeline.tsx` | 🟡 需确认 |
| 无时间区（kind=once 无 scheduledAt） | ui-design.md | `Timeline.tsx` | 🟡 需确认 |
| 已完成折叠区 | ui-design.md | `Timeline.tsx` | 🟡 需确认 |
| blocked AI 任务内联显示关联 human 任务 | ui-design.md | `Timeline.tsx` | 🟡 需确认 |
| human 任务勾选完成后 AI 任务自动恢复动画 | ui-design.md | 未见明确动画实现 | ❌ |

### 状态视觉映射

| 状态 | 设计 | 实现 | 状态 |
|------|------|------|------|
| AI pending：灰色空心圆 | ui-design.md | `TaskStatusIcon.tsx` | 🟡 需确认 |
| AI running：绿色实心点（波动动画） | ui-design.md | `TaskStatusIcon.tsx` | 🟡 需确认 |
| AI blocked：橙色 ⏸ | ui-design.md | `TaskStatusIcon.tsx` | 🟡 需确认 |
| AI failed：红色 ✗ | ui-design.md | `TaskStatusIcon.tsx` | 🟡 需确认 |
| AI done：灰色 ✓ | ui-design.md | `TaskStatusIcon.tsx` | 🟡 需确认 |
| human pending：红色空心圆（可勾选） | ui-design.md | `TaskRow.tsx` | 🟡 需确认 |

### 任务编辑面板

| 特性 | 设计 | 实现 | 状态 |
|------|------|------|------|
| 标题、描述、归属项目、启用/禁用 | ui-design.md | `TaskForm.tsx` + `TaskDetail.tsx` | ✅ |
| AI 任务：executor 类型选择（ai_prompt/script/http） | ui-design.md | `TaskForm.tsx` | ✅ |
| ai_prompt：prompt 文本 + 占位符支持 | ui-design.md | `TaskForm.tsx` | ✅ |
| script：命令 + 工作目录 | ui-design.md | `TaskForm.tsx` | ✅ |
| http：URL + Method + Body | ui-design.md | `TaskForm.tsx` | ✅ |
| http：Headers 配置 | ui-design.md | `TaskForm.tsx` 中未见 headers 字段 | ❌ |
| 执行服务（tool/model 选择） | ui-design.md | `TaskForm.tsx` 有 model 字段 | 🟡 注2 |
| includeLastOutput toggle | ui-design.md | `TaskForm.tsx` | ✅ |
| reviewOnComplete toggle | ui-design.md | `TaskForm.tsx` | ✅ |
| scheduled：datetime-local | ui-design.md | `TaskForm.tsx` | ✅ |
| recurring：cron + 常用模板 | ui-design.md | `TaskForm.tsx` | ✅ |
| human 任务：waitingInstructions（只读） | ui-design.md | `TaskDetail.tsx` 展示 | ✅ |
| human 任务：来源任务（只读） | ui-design.md | `TaskDetail.tsx` 展示 | ✅ |
| 执行记录 tab（runs） | ui-design.md | `TaskDetail.tsx` | ✅ |
| 操作记录 tab（ops） | ui-design.md | `TaskDetail.tsx` | ✅ |
| 实时执行输出（RunViewer） | ui-design.md | `RunViewer.tsx` | ✅ |

> 注2：设计中"执行服务"指 tool/model 选择，当前只实现了 model 字段，tool（如 bash tool）选择未实现。

### 项目管理

| 特性 | 设计 | 实现 | 状态 |
|------|------|------|------|
| 侧边栏项目列表 | ui-design.md | `Sidebar.tsx` | ✅ |
| 红点标记有待处理 human 任务的项目 | ui-design.md | `Sidebar.tsx` | ✅ |
| 归档项目折叠在底部 | ui-design.md | `Sidebar.tsx` | ✅ |
| 新建项目 | ui-design.md | `App.tsx:handleNewProject` | ✅ |
| 项目设置（名称/goal/workDir/systemPrompt） | ui-design.md | `ProjectSettings.tsx` | ✅ |
| 项目归档/删除 | ui-design.md | `ProjectSettings.tsx` | ✅ |

---

## 未实现 / 待办

以下是设计文档中明确提到但当前代码中未实现的内容：

| 功能 | 来源 | 备注 |
|------|------|------|
| 默认项目"日常事务"自动创建 | architecture.md | 系统启动时应保证存在 |
| 日常事务不可删除/改名/归档的保护逻辑 | architecture.md | 需要在 model 层或 API 层加守卫 |
| `daemon start` / `daemon status` CLI 命令 | cli-api.md | 目前服务只能前台运行 |
| `conductor version` / `conductor info` 命令 | cli-api.md | 未确认是否已实现 |
| task_logs output 截断至 64KB | database-schema.md | executor 输出未做截断 |
| task_logs 保留最近 50 条的清理逻辑 | data-model.md | 有 limit 查询但无定期清理 |
| http executor Headers 配置（UI） | ui-design.md | TaskForm 中缺少 headers 输入 |
| human 任务勾选完成后的动画过渡 | ui-design.md | 纯视觉细节 |
| `{lastOutput}` 正确注入上次 AI 执行结果 | execution-model.md | 当前注入的是 completionOutput |
| workflow 作为显式对象 | architecture.md | To Do 项，长期规划 |
