# 接入 Conductor

> 本文面向需要与 Conductor 交互的 **AI agent** 和外部程序。  
> 核心原则：**按需查阅，不要一次读完所有内容。**

---

## 快速上手：用 `/plan-project` 规划你的第一个项目

如果你在 Claude Code 里工作，可以直接运行：

```
/plan-project
```

这个 skill 会通过对话帮你把一个模糊的长期目标（理财计划、产品开发、团队流程…）转化为 Conductor 里可执行的任务系统，预览确认后自动写入。

适合：个人目标、产品研发、研究项目、团队运营流程等任何需要长期跟踪的工作。

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

### 第二步：找到你要操作的项目

```bash
conductor project list --json
```

输出示例：
```json
[{ "id": "proj_a1b2c3", "name": "每日任务", "archived": false }]
```

> 如果没有合适的项目，用 `conductor project create --name "..." --json` 创建一个。

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

- 同步执行，等待完成后返回最终 Task 对象
- 只能触发 `assignee = ai` 且配置了 executor 的任务
- 执行结果在返回的 `status` 字段（`done` 或 `failed`）

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

**订阅实时事件**（SSE）：
```http
GET /api/events?projectId=proj_a1b2c3
```

事件类型：`task_created` | `task_updated` | `task_deleted` | `run_line`（AI 实时输出行）

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

## 完整 API 索引

所有命令和接口的完整签名、参数说明、响应格式见 [cli-api.md](cli-api.md)。
