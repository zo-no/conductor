# 接入 Conductor

> 本文面向需要与 Conductor 交互的 **AI agent** 和外部程序。  
> 核心原则：**按需查阅，不要一次读完所有内容。**

## 快速找命令

```bash
conductor help-ai   # 输出 JSON 速查表，覆盖所有命令，分 tasks / projects / groups / prompts / tts / system 六类
```

不确定某个命令的参数：

```bash
conductor task --help
conductor task create --help
```

---

## 安装

```bash
# 前置要求：Bun (https://bun.sh) + pnpm (https://pnpm.io)

git clone https://github.com/zo-no/conductor ~/conductor
cd ~/conductor
pnpm install
pnpm install:cli        # 编译二进制并复制到 ~/.bun/bin/conductor

# 验证安装
conductor version
```

确保 `~/.bun/bin` 在 PATH 里：

```bash
export PATH="$HOME/.bun/bin:$PATH"   # 加到 ~/.bashrc 或 ~/.zshrc
```

---

## 5 步 Quickstart（从零到第一个任务）

```bash
# 1. 启动后台 daemon（调度器 + HTTP API，端口 7762）
conductor daemon start

# 2. 查看默认项目
conductor project list --json
# → [{ "id": "proj_default", "name": "日常事务", ... }]

# 3. 创建一个 AI 任务
conductor task create \
  --title "测试任务" \
  --project proj_default \
  --assignee ai \
  --kind once \
  --executor-kind ai_prompt \
  --prompt "用一句话描述今天的日期：{date}" \
  --json
# → { "id": "task_xxx", "status": "pending", ... }

# 4. 立即触发执行（同步，等待完成）
conductor task run task_xxx --json
# → { "id": "task_xxx", "status": "done", ... }

# 5. 查看执行日志
conductor task logs task_xxx --json
# → [{ "status": "success", "output": "今天是 2026-04-16。", ... }]
```

> **不知道下一步该用什么命令？** 运行 `conductor help-ai` 获取 JSON 格式意图速查表。

---

## 鉴权 / Authentication

Conductor 默认无鉴权。如果你的 Conductor 实例启用了鉴权（`conductor auth status` 显示 ENABLED），需要在每个 API 请求里携带令牌：

**CLI**：CLI 直接读写本地 SQLite，不经过 HTTP，**不需要令牌**。

**HTTP API**：
```bash
# Header（推荐）
curl -H "Authorization: Bearer <token>" http://localhost:7762/api/tasks

# Query param（SSE 用）
curl "http://localhost:7762/api/events?projectId=<id>&token=<token>"
```

令牌通过 `conductor auth token` 生成，详见 [auth.md](auth.md)。

---

## 我应该用 CLI 还是 HTTP API？

| 场景 | 推荐方式 |
|------|----------|
| 你是 AI agent（Claude Code、Codex 等），在终端里工作 | **CLI** |
| 你是后端服务、需要远程调用 | **HTTP API** |
| 你需要实时流式输出（SSE） | **HTTP API** |
| 你不想依赖 daemon 是否在运行 | **CLI**（直接读写本地 SQLite） |

---

## CLI 接入（AI Agent 首选）

### 第一步：确认环境

```bash
conductor version        # 确认已安装
conductor daemon status  # 可选，查看调度器是否在运行
```

> **快捷参考**：运行 `conductor help-ai` 获取 JSON 格式速查表。覆盖任务、项目、分组等所有常用操作，包括分组管理意图（`list groups`、`create group`、`add project to group`、`hide project from sidebar` 等）。

### 第二步：找到你要操作的项目

```bash
conductor project list --json
```

输出示例：
```json
[{ "id": "proj_a1b2c3", "name": "每日任务", "archived": false, "groupId": null, "pinned": true }]
```

> 如果没有合适的项目，用 `conductor project create --name "..." --json` 创建一个。

项目可以归属于**分组（ProjectGroup）**。查看当前分组结构：

```bash
conductor group list --json
```

如需把项目加入分组或了解分组管理，见下方 [分组管理](#分组管理)。

### 第三步：根据你的目标选择操作

**→ 我想查看已有任务**  
见下方 [查询任务](#查询任务)

**→ 我想注册一个新的 AI 自动化任务**  
见下方 [创建 AI 任务](#创建-ai-任务)

**→ 我需要人类确认某件事，然后继续执行**  
见下方 [创建人类等待任务](#创建人类等待任务卡点)

**→ 我想立即执行一个任务**  
见下方 [手动触发任务](#手动触发任务)

**→ 我是人类，要标记某个任务完成**  
见下方 [标记人类任务完成](#标记人类任务完成)

---

### 查询任务

```bash
# 列出项目下的所有任务
conductor task list --project <project-id> --json

# 查看某个任务的详情（包括当前状态）
conductor task get <task-id> --json

# 查看执行历史（最近 20 条）
conductor task logs <task-id> --json

# 查看操作审计记录
conductor task ops <task-id> --json
```

**任务状态说明**：

| status | 含义 |
|--------|------|
| `pending` | 等待调度或手动触发 |
| `running` | 正在执行 |
| `done` | 执行成功 |
| `failed` | 执行失败 |
| `blocked` | 等待某个人类任务完成 |
| `cancelled` | 已取消 |

---

### 创建 AI 任务

根据任务类型选择不同的 `--kind`：

```bash
# 一次性任务（立即或手动触发）
conductor task create \
  --title "分析本次 PR 的安全风险" \
  --project <project-id> \
  --assignee ai \
  --kind once \
  --executor-kind ai_prompt \
  --prompt "请分析以下代码变更的安全风险：{taskDescription}" \
  --json

# 定时任务（指定时间执行一次）
conductor task create \
  --title "发布前检查" \
  --project <project-id> \
  --assignee ai \
  --kind scheduled \
  --scheduled-at "2026-04-20T09:00" \
  --executor-kind ai_prompt \
  --prompt "执行发布前检查清单" \
  --json

# 重复任务（按 cron 周期执行）
conductor task create \
  --title "每日代码质量报告" \
  --project <project-id> \
  --assignee ai \
  --kind recurring \
  --cron "0 9 * * 1-5" \
  --executor-kind ai_prompt \
  --prompt "今天是 {date}，请生成代码质量摘要" \
  --json
```

> **执行器不止 ai_prompt**，还有 `script`（运行 shell 命令）和 `http`（调用 HTTP 接口）。  
> 详见 [执行器参考](#执行器参考)。

---

### 创建人类等待任务（卡点）

当 AI 需要人类确认后才能继续时，创建一个 human 任务，再创建一个依赖它的 AI 任务：

```bash
# 1. 创建人类确认任务
conductor task create \
  --title "确认部署到生产环境" \
  --project <project-id> \
  --assignee human \
  --kind once \
  --instructions "请检查 staging 环境，确认无误后运行：conductor task done <id> --output '已确认，版本 v1.2.3'" \
  --json
# → 记录返回的 id，假设是 task_human01

# 2. 创建依赖该 human 任务的 AI 任务
conductor task create \
  --title "执行生产部署" \
  --project <project-id> \
  --assignee ai \
  --kind once \
  --depends-on task_human01 \
  --executor-kind script \
  --script "deploy.sh {lastOutput}" \
  --json
```

人类完成确认后（运行 `task done`），AI 任务会自动解锁并执行，`{lastOutput}` 会注入人类填写的 output。

---

### 手动触发任务

```bash
conductor task run <task-id> --json
```

- **同步执行**：等待任务完成后才返回，返回值是最终 Task 对象
- 只能触发 `assignee = ai` 且配置了 executor 的任务
- 执行结果在返回的 `status` 字段（`done` 或 `failed`）

> ⚠️ **CLI vs HTTP 的重要差异**  
> `conductor task run`（CLI）是**同步**的，会阻塞直到任务完成。  
> `POST /api/tasks/:id/run`（HTTP）是**异步**的，立即返回 `{ ok: true }`，需要通过轮询 `GET /api/tasks/:id` 或监听 SSE 事件来跟踪完成状态。

---

### 标记人类任务完成

```bash
conductor task done <task-id> --output "完成说明（可选）" --json
```

- `--output` 的内容会作为 `{lastOutput}` 注入给被解锁的 AI 任务
- 如果有 AI 任务在等待这个 human 任务，会自动触发执行

---

### 取消任务

```bash
conductor task cancel <task-id> --json
```

---

### 分组管理

项目可以归属于分组，分组在侧边栏按层级展示。AI 可通过 CLI 完整操作分组：

```bash
# 查看所有分组（含各分组内的项目）
conductor group list --json

# 创建分组
conductor group create --name "Q2 产品研发" --created-by ai --json
# → { "id": "group_abc", "name": "Q2 产品研发", ... }

# 将项目加入分组
conductor project update <project-id> --group <group-id> --json

# 将项目移出分组（回到未分组）
conductor project update <project-id> --no-group --json

# 将后台项目设为不固定显示（折叠到侧边栏"更多"区）
conductor project update <project-id> --no-pin --json

# 重新排列分组顺序
conductor group reorder <id1> <id2> ... --json

# 重新排列分组内项目顺序
conductor group reorder-projects <group-id> <proj-id1> <proj-id2> ... --json

# 删除分组（分组内项目移到未分组）
conductor group delete <group-id> --json
```

---

## HTTP API 接入

适合后端服务、需要实时事件流、或需要远程调用的场景。

**前提**：daemon 必须在运行
```bash
conductor daemon start
```

**Base URL**：`http://localhost:7762`

### 核心流程

```
创建任务  →  触发执行  →  监听事件流  →  查询结果
```

**创建并触发任务**：
```http
POST /api/tasks
Content-Type: application/json

{
  "title": "每日晨报",
  "projectId": "proj_a1b2c3",
  "assignee": "ai",
  "kind": "once",
  "executor": {
    "kind": "ai_prompt",
    "prompt": "今天是 {date}，请生成工作摘要"
  }
}
```

```http
POST /api/tasks/task_xyz/run
```

**触发后轮询状态**（HTTP run 是异步的）：
```http
# 触发后立即返回，不等待完成
POST /api/tasks/task_xyz/run
→ { "ok": true, "taskId": "task_xyz" }

# 轮询直到 status 不是 "running"
GET /api/tasks/task_xyz
→ { "status": "running" | "done" | "failed" | ... }
```

**或者订阅实时事件**（SSE，推荐）：
```http
GET /api/events?projectId=proj_a1b2c3
```

事件类型：`task_created` | `task_updated` | `task_deleted` | `run_line`（AI 实时输出行）  
收到 `task_updated` 后再 `GET /api/tasks/:id` 获取最新状态。

**查询任务状态**：
```http
GET /api/tasks/task_xyz
```

**标记 human 任务完成**：
```http
POST /api/tasks/task_xyz/done
Content-Type: application/json

{ "output": "已确认" }
```

> 完整的请求体结构、响应格式、所有端点列表见 [cli-api.md](cli-api.md#http-api)。

---

## 执行器参考

> 只在需要配置 executor 时查阅本节。

### `ai_prompt` — 调用 AI agent

```bash
--executor-kind ai_prompt \
--prompt "你的指令，支持 {date} {taskTitle} 等占位符" \
[--model claude-opus-4-5]    # 可选，覆盖默认模型
```

HTTP 等效：
```json
"executor": {
  "kind": "ai_prompt",
  "prompt": "...",
  "agent": "claude",
  "model": "claude-opus-4-5"
}
```

---

### `script` — 运行 shell 命令

```bash
--executor-kind script \
--script "python3 ~/scripts/daily.py" \
[--work-dir "~/projects/xxx"]   # 执行目录
```

HTTP 等效：
```json
"executor": {
  "kind": "script",
  "command": "python3 ~/scripts/daily.py",
  "workDir": "~/projects/xxx",
  "timeout": 300
}
```

---

### `http` — 调用 HTTP 接口

```bash
--executor-kind http \
--http-url "https://api.example.com/webhook" \
--http-method POST \
--http-body '{"event":"daily_run"}'
```

HTTP 等效：
```json
"executor": {
  "kind": "http",
  "url": "https://api.example.com/webhook",
  "method": "POST",
  "body": "{\"event\":\"daily_run\"}",
  "timeout": 30
}
```

---

## 占位符变量

Prompt 和脚本命令中可使用以下变量，执行时自动替换：

| 变量 | 值 |
|------|----|
| `{date}` | 当前日期，`YYYY-MM-DD` |
| `{datetime}` | 当前日期时间，`YYYY-MM-DD HH:mm` |
| `{taskTitle}` | 任务标题 |
| `{taskDescription}` | 任务描述 |
| `{projectName}` | 所属项目名称 |
| `{lastOutput}` | 上一个任务的 completionOutput（human 任务完成时填写）|
| `{自定义}` | `--custom-var key=value` 定义的变量 |

---

## 语音通知

AI 任务完成或失败时可自动播报语音。在创建/更新任务时通过 `--voice-notice` 开启：

```bash
conductor task create --title "生成报告" ... \
  --voice-notice \
  --speech-text "报告已生成，请查收"

conductor task update <id> --voice-notice --speech-text "数据分析完成"
conductor task update <id> --no-voice-notice
```

TTS 配置（讯飞 / macOS say）：

```bash
conductor tts status --json
conductor tts config --provider xfyun --app-id <id> --api-key <key> --api-secret <secret>
conductor tts test "测试播报"
```

详见 [voice-notice.md](voice-notice.md)。

---

## 完整 API 索引

所有命令和接口的完整签名、参数说明、响应格式见 [cli-api.md](cli-api.md)。
