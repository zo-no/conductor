# Conductor

**本地优先的任务调度引擎，人类和 AI 共用的 todo list + agent 调度器。**

A local-first task scheduling engine — a unified todo list and agent scheduler for humans and AI.

---

## 它是什么 / What it is

Conductor 把人类任务和 AI 任务放在同一个列表里。人类处理需要判断的事，AI 自动执行可以自动化的事。两者共享同一个项目、同一条时间线、同一套审计日志。

Conductor puts human and AI tasks in the same list. Humans handle what needs judgment; AI handles what can be automated. Both share the same project, timeline, and audit trail.

- **统一任务列表** — 每个任务有 `assignee`（`human` / `ai`）和 `kind`（`once` / `scheduled` / `recurring`）
- **AI 任务执行** — 三种执行器：`ai_prompt`（调用 Claude/Codex）、`script`（shell 命令）、`http`（HTTP 接口）
- **Human-in-the-loop** — AI 遇到卡点时创建人类任务阻塞自己，人类完成后自动恢复
- **本地优先** — 数据存 `~/.conductor/db.sqlite`，无云服务，无账号
- **实时 UI** — React Web 界面，SSE 实时推送任务状态和 AI 执行输出

---

## 快速开始 / Quick start

**前置要求：** [Bun](https://bun.sh) + [pnpm](https://pnpm.io)

```bash
# 克隆并安装 / Clone and install
git clone https://github.com/zo-no/conductor ~/conductor
cd ~/conductor
pnpm install

# 构建并安装 CLI / Build and install CLI
pnpm build
pnpm install:cli   # copies to ~/.bun/bin/conductor

# 验证 / Verify
conductor version

# 启动后台服务 / Start backend (port 7762)
conductor daemon start

# 启动 Web UI / Start web UI (port 5173)
pnpm dev:web
# Open http://localhost:5173
```

---

## Web UI

打开 `http://localhost:5173`。

Open `http://localhost:5173`.

**PC 端 / Desktop:**
- 三栏布局：可折叠侧边栏（项目列表 + 分组）、时间线主区域、浮动任务详情卡片
- 时间线按日期分区：今天 / 未来 / 周期任务 / 无时间 / 已完成
- 实时查看 AI 任务的流式执行输出
- 批量选择和删除任务
- 侧边栏底部切换语言（中文 / English）

**移动端 / Mobile:**
- 顶部 header：左侧汉堡菜单（项目抽屉，从左滑出）、中间项目名、右侧设置图标
- 左右滑动切换项目
- 任务详情从右侧浮动卡片展示（背景高斯模糊）
- 右下角 FAB 按钮新建任务

---

## 核心概念 / Core concepts

### Project

任务的上下文边界。每个项目可以设置：
- `goal` — 目标描述，注入 AI 上下文
- `workDir` — 脚本执行默认目录
- `systemPrompt` — 项目级 prompt，追加在系统 prompt 之后
- `group` — 所属分组（侧边栏分组展示）
- `pinned` — 是否固定显示在侧边栏

### Task

系统唯一的执行单元，两个正交维度：

| `assignee` | `kind` | 场景 / Example |
|------------|--------|----------------|
| `human` | `once` | 临时待办 / One-off to-do |
| `human` | `recurring` | 周期打卡 / Weekly check-in |
| `ai` | `once` | 手动触发的 AI 任务 / On-demand AI task |
| `ai` | `scheduled` | 定时执行 / Run at 9am Friday |
| `ai` | `recurring` | 周期执行 / Daily standup notes |

### AI Task Executors

**`ai_prompt`** — 调用 AI agent 执行 prompt：
```json
{
  "kind": "ai_prompt",
  "prompt": "总结 {date} 的工作进展。项目：{projectName}",
  "agent": "claude"
}
```

支持占位符：`{date}` `{datetime}` `{taskTitle}` `{taskDescription}` `{projectName}` `{lastOutput}` 以及自定义变量。

**`script`** — 运行 shell 命令：
```json
{ "kind": "script", "command": "python3 ~/scripts/report.py", "workDir": "~/projects/myapp" }
```

**`http`** — 调用 HTTP 接口：
```json
{ "kind": "http", "url": "https://api.example.com/webhook", "method": "POST" }
```

### Prompt 三层结构 / Prompt layers

```
[系统级 prompt]    ← 全局，侧边栏底部设置
[项目级 prompt]    ← 每个项目，项目设置里配置
[任务 prompt]      ← executor.prompt
```

三层拼接后统一替换占位符变量。

### Human-in-the-loop

```
AI 任务（status: blocked）
  └─ 人类任务（status: pending）← 在 UI 里可见，可勾选完成
```

人类完成任务后（可附带输出文字），AI 任务自动恢复，输出注入为 `{lastOutput}`。

---

## CLI 速查 / CLI reference

```bash
# 项目 / Projects
conductor project list
conductor project create --name "My Project" --goal "Ship v2"
conductor project update <id> --goal "Updated goal"
conductor project delete <id>
conductor project archive <id>

# 任务 / Tasks
conductor task list --project <id>
conductor task create --title "每日晨报" --project <id> \
  --assignee ai --kind recurring --cron "0 9 * * *" \
  --prompt "总结 {date} 的工作进展"
conductor task run <id>
conductor task done <id> --output "已确认"
conductor task cancel <id>
conductor task logs <id>

# 分组 / Groups
conductor group list
conductor group create --name "工作"
conductor group delete <id>

# Prompt
conductor prompt get                     # 系统级 / system-level
conductor prompt set "You are..."        # 设置系统 prompt
conductor prompt get --project <id>      # 项目级 / project-level
conductor prompt set "..." --project <id>

# 服务 / Daemon
conductor daemon start
conductor daemon status
conductor daemon stop
conductor info

# AI agent 速查表 / AI agent quick reference
conductor help-ai
```

完整 API 参考 / Full API reference: [docs/cli-api.md](docs/cli-api.md)

---

## HTTP API

Base URL: `http://localhost:7762`

```
# Projects
GET/POST    /api/projects
GET/PATCH/DELETE  /api/projects/:id
POST        /api/projects/:id/archive
POST        /api/projects/:id/unarchive

# Groups
GET/POST    /api/groups
GET/PATCH/DELETE  /api/groups/:id
POST        /api/groups/reorder
POST        /api/groups/:id/projects/reorder

# Tasks
GET/POST    /api/tasks
GET/PATCH/DELETE  /api/tasks/:id
POST        /api/tasks/:id/run
POST        /api/tasks/:id/done
POST        /api/tasks/:id/cancel
GET         /api/tasks/:id/logs
GET         /api/tasks/:id/ops
GET         /api/tasks/:id/runs
GET         /api/tasks/:id/runs/:runId/spool

# Prompts
GET/PATCH   /api/prompts/system
GET/PATCH   /api/prompts/project/:id
DELETE      /api/prompts/project/:id

# Real-time
GET         /api/events?projectId=   # SSE stream
GET         /health
```

---

## 内置项目 / Built-in projects

首次启动自动创建 / Created automatically on first start:

**Conductor**（系统维护 / maintenance）:
- 清理执行输出流水 — 每天 03:00
- 清理操作审计记录 — 每周日 03:30
- WAL Checkpoint & 优化 — 每天 04:00

**日常事务 / Daily**:
- 每日工作梳理 — 每天 21:00（AI 自动生成 / AI-generated）

所有预置任务可修改、禁用，重启不会覆盖。

All built-in tasks can be modified or disabled. Restarts won't overwrite your changes.

---

## 开发 / Development

```bash
# 后端测试 / Backend tests
pnpm --filter @conductor/core test
pnpm --filter @conductor/core test:models
pnpm --filter @conductor/core test:http
pnpm --filter @conductor/core test:scheduler
pnpm --filter @conductor/core test:events

# 前端 timeline 测试 / Frontend timeline tests
bun packages/web/src/lib/timeline.test.ts

# 前端类型检查 / Frontend type check
pnpm --filter @conductor/web exec tsc --noEmit
```

---

## 文档 / Docs

| 文档 | Doc |
|------|-----|
| [架构概览](docs/architecture.md) | Architecture overview |
| [执行模型](docs/execution-model.md) | Execution model (sessions, scheduling, prompts) |
| [CLI & HTTP API](docs/cli-api.md) | Full CLI & HTTP API reference |
| [接入指南](docs/integration.md) | Integration guide for AI agents |
| [UI 设计](docs/ui-design.md) | Web UI design notes |
| [国际化](docs/i18n.md) | i18n guide (zh/en) |

---

## 数据存储 / Data storage

```
~/.conductor/db.sqlite   # 所有数据 / All data
~/.conductor/            # 数据目录 / Data directory
```

本地 SQLite，无云服务，无账号。

Local SQLite. No cloud. No accounts.
