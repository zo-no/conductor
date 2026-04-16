# CLI & HTTP API 参考

> 所有 CLI 命令支持 `--json` 输出，方便 AI 或脚本解析。  
> HTTP API 默认端口 `7762`，所有响应均为 JSON。

---

## 数据类型

### ProjectGroup

```ts
{
  id: string          // "group_" + hex，例如 "group_a1b2c3"
  createdAt: string   // ISO 8601
  updatedAt: string

  name: string
  order: number       // 侧边栏展示顺序（数值越小越靠前）
  collapsed: boolean  // 默认是否折叠（true = 侧边栏默认收起）
  createdBy: "human" | "ai" | "system"

  projects?: Project[] // GET /api/groups 时附带分组内的项目列表
}
```

### Project

```ts
{
  id: string          // "proj_" + hex，例如 "proj_a1b2c3"
  createdAt: string   // ISO 8601
  updatedAt: string

  name: string
  goal?: string       // 项目目标描述
  workDir?: string    // 项目工作目录（可在 customVars 中引用）
  systemPrompt?: string

  archived: boolean
  archivedAt?: string

  groupId?: string    // 归属分组 id，null = 未分组
  order: number       // 在分组内（或未分组列表中）的展示顺序
  pinned: boolean     // false = 折叠到侧边栏"更多"区，默认 true
  createdBy: "human" | "ai" | "system"
}
```

### ProjectsView

前端侧边栏主视图结构，由 `GET /api/view/projects` 返回。

```ts
{
  groups: Array<ProjectGroup & { projects: Project[] }>  // 有分组的项目，按 group.order 排序
  ungrouped: Project[]                                   // groupId=null 的项目，按 project.order 排序
}
```

### Task

```ts
{
  id: string          // "task_" + hex
  createdAt: string
  updatedAt: string

  projectId: string
  title: string
  description?: string

  assignee: "ai" | "human"
  kind: "once" | "scheduled" | "recurring"
  status: "pending" | "running" | "done" | "failed" | "cancelled" | "blocked"

  order?: number      // 展示排序（数值越小越靠前）
  dependsOn?: string  // 前置任务 id，该任务 done 后本任务才会触发

  // 调度配置（kind = scheduled 或 recurring 时有效）
  scheduleConfig?: ScheduledConfig | RecurringConfig

  // 执行器（assignee = ai 时有效）
  executor?: ScriptExecutor | AiPromptExecutor | HttpExecutor
  executorOptions?: ExecutorOptions

  // human 任务专用
  waitingInstructions?: string  // AI 写给人类的操作说明
  sourceTaskId?: string         // 创建本 human 任务的 AI 任务 id

  // 阻塞/恢复
  blockedByTaskId?: string      // 本任务正在等待哪个 human 任务
  completionOutput?: string     // human 任务完成时填写的输出，注入为 {lastOutput}

  enabled: boolean              // false 时调度器跳过
  createdBy: "human" | "ai"
  lastSessionId?: string        // 最近一次 AI 执行的 session id（备用）
}
```

#### ScheduledConfig

```ts
{
  kind: "scheduled"
  scheduledAt: string   // ISO 8601，例如 "2026-04-20T09:00:00"
}
```

#### RecurringConfig

```ts
{
  kind: "recurring"
  cron: string          // 标准 5 字段 cron，例如 "0 9 * * *"
  timezone?: string
  lastRunAt?: string    // 只读，调度器更新
  nextRunAt?: string    // 只读，调度器更新
}
```

#### ScriptExecutor

```ts
{
  kind: "script"
  command: string       // shell 命令，例如 "python3 ~/scripts/daily.py"
  workDir?: string      // 执行目录，默认继承 daemon 工作目录
  env?: Record<string, string>  // 附加环境变量
  timeout?: number      // 超时秒数，默认 300
}
```

#### AiPromptExecutor

```ts
{
  kind: "ai_prompt"
  prompt: string        // 发送给 AI 的指令，支持占位符变量
  agent?: "claude" | "codex"  // 默认 "claude"
  model?: string        // 覆盖默认模型，例如 "claude-opus-4-5"
}
```

#### HttpExecutor

```ts
{
  kind: "http"
  url: string
  method: "GET" | "POST" | "PUT" | "DELETE"
  headers?: Record<string, string>
  body?: string         // 请求体字符串
  timeout?: number      // 超时秒数，默认 30
}
```

#### ExecutorOptions

```ts
{
  customVars?: Record<string, string>  // 自定义占位符变量，注入 prompt
  reviewOnComplete?: boolean           // 执行完成后自动创建人类 review 任务
  continueSession?: boolean            // 保留字段，暂未启用
}
```

### 占位符变量

Prompt 中可使用以下变量，执行时自动替换：

| 变量 | 说明 |
|------|------|
| `{date}` | 当前日期，格式 `YYYY-MM-DD` |
| `{datetime}` | 当前日期时间，格式 `YYYY-MM-DD HH:mm` |
| `{taskTitle}` | 任务标题 |
| `{taskDescription}` | 任务描述 |
| `{projectName}` | 所属项目名称 |
| `{lastOutput}` | 上一个任务（或 human 任务）的 completionOutput |
| `{<key>}` | executorOptions.customVars 中定义的自定义变量 |

### TaskLog

```ts
{
  id: string
  taskId: string
  startedAt: string
  completedAt?: string
  status: "success" | "failed" | "cancelled" | "skipped"
  output?: string       // stdout + stderr，截断至 64KB
  error?: string
  triggeredBy: "manual" | "scheduler" | "api" | "cli"
  skipReason?: string   // status = skipped 时填写原因
}
```

### TaskOp（操作审计）

```ts
{
  id: string
  taskId: string
  op: "created" | "triggered" | "status_changed" | "done"
    | "cancelled" | "review_created" | "unblocked" | "deleted"
  fromStatus?: string
  toStatus?: string
  actor: "human" | "ai" | "scheduler"
  note?: string
  createdAt: string
}
```

### TaskRun（AI 执行记录）

```ts
{
  id: string            // "run_" + hex
  taskId: string
  startedAt: string
  completedAt?: string
  status: "running" | "done" | "failed"
  exitCode?: number
  sessionId?: string    // claude --output-format stream-json 返回的 session id
}
```

---

## CLI 命令

### 任务

#### `conductor task list`

列出任务，支持多维过滤。

```bash
conductor task list \
  [--project <id>]           # 按项目过滤
  [--kind once|scheduled|recurring]
  [--assignee ai|human]
  [--status pending|running|done|failed|cancelled|blocked]
  [--json]
```

**输出**：Task 数组。

---

#### `conductor task get <id>`

获取单个任务完整信息。

```bash
conductor task get <task-id> [--json]
```

**输出**：Task 对象，找不到则报错退出。

---

#### `conductor task logs <id>`

获取任务的执行历史（最近 N 条，每个任务最多保留 50 条）。

```bash
conductor task logs <task-id> [--limit 20] [--json]
```

**输出**：TaskLog 数组，按 startedAt 倒序。

---

#### `conductor task ops <id>`

获取任务的操作审计记录（永久保留，不滚动删除）。

```bash
conductor task ops <task-id> [--limit 20] [--json]
```

**输出**：TaskOp 数组，按 createdAt 倒序。

---

#### `conductor task create`

创建任务。AI 任务和 human 任务的参数略有不同。

```bash
# 必填
conductor task create \
  --title <title> \
  --project <project-id>

# 任务属性
  [--assignee ai|human]          # 默认 human
  [--kind once|scheduled|recurring]  # 默认 once
  [--description <text>]

# 调度（kind = scheduled 时必填一个）
  [--scheduled-at <ISO8601>]     # 一次性定时，例如 "2026-04-20T09:00"
  [--cron <expr>]                # 重复执行，例如 "0 9 * * *"

# 执行器（assignee = ai 时配置）
  [--executor-kind ai_prompt|script|http]   # 不传时根据其他参数自动推断
  [--prompt <text>]              # AI prompt（ai_prompt 执行器）
  [--model <model-id>]           # 覆盖 AI 模型
  [--script <command>]           # shell 命令（script 执行器）
  [--work-dir <path>]            # 脚本执行目录
  [--http-url <url>]             # 请求 URL（http 执行器）
  [--http-method GET|POST|PUT|DELETE]  # 默认 GET
  [--http-body <string>]         # 请求体

# 执行选项
  [--include-last-output]        # 将 completionOutput 注入为 {lastOutput}
  [--review-on-complete]         # 执行完成后创建 human review 任务
  [--custom-var key=value]       # 自定义占位符，可重复传多个

# 依赖与关联
  [--depends-on <task-id>]       # 前置任务，完成后才触发本任务
  [--source-task <task-id>]      # 本 human 任务来自哪个 AI 任务（AI 创建时使用）

# Human 任务专用
  [--instructions <text>]        # 展示给人类的操作说明

# 元信息
  [--created-by human|ai]        # 默认 human

  [--json]
```

**输出**：新建的 Task 对象。

**执行器自动推断规则**（不传 `--executor-kind` 时）：
- 传了 `--prompt` → `ai_prompt`
- 传了 `--script` → `script`
- 传了 `--http-url` → `http`

---

#### `conductor task update <id>`

更新任务属性。只传需要修改的字段，未传的字段保持不变。

```bash
conductor task update <task-id> \
  [--title <text>]
  [--description <text>]
  [--prompt <text>]              # 仅对 ai_prompt 执行器有效
  [--cron <expr>]                # 仅对 recurring 任务有效
  [--scheduled-at <ISO8601>]     # 仅对 scheduled 任务有效
  [--enable]                     # 启用任务（调度器将执行）
  [--disable]                    # 禁用任务（调度器跳过）
  [--json]
```

**输出**：更新后的 Task 对象。

---

#### `conductor task delete <id>`

删除任务及其所有关联数据（logs、ops、runs、spool）。

```bash
conductor task delete <task-id> [--json]
```

**输出**：`{ ok: true }`

---

#### `conductor task run <id>`

手动立即触发一个 AI 任务执行（同步等待完成）。

```bash
conductor task run <task-id> [--json]
```

**限制**：只能触发 `assignee = ai` 且配置了 executor 的任务。

**行为**：
1. 状态改为 `running`
2. 执行 executor
3. 成功 → `done`（recurring 任务回到 `pending`）；失败 → `failed`
4. 记录 TaskLog 和 TaskOp

**输出**：执行完成后的 Task 对象。

---

#### `conductor task done <id>`

将 human 任务标记为完成，并自动解除阻塞等待该任务的 AI 任务。

```bash
conductor task done <task-id> \
  [--output <text>]   # 完成说明，注入为 {lastOutput} 传给被解锁的 AI 任务
  [--json]
```

**限制**：只能操作 `assignee = human` 的任务。

**行为**：
1. 状态改为 `done`，保存 `completionOutput`
2. 查找所有 `blockedByTaskId = <id>` 的 AI 任务
3. 将这些 AI 任务状态改为 `pending`，清除 `blockedByTaskId`，注入 `completionOutput`
4. 异步触发这些 AI 任务执行

**输出**：更新后的 human Task 对象。

---

#### `conductor task cancel <id>`

取消任务，将状态改为 `cancelled`。

```bash
conductor task cancel <task-id> [--json]
```

**输出**：更新后的 Task 对象。

---

### 项目

#### `conductor project list`

```bash
conductor project list [--json]
```

**输出**：Project 数组（包含已归档项目）。

---

#### `conductor project get <id>`

```bash
conductor project get <project-id> [--json]
```

**输出**：Project 对象。

---

#### `conductor project create`

```bash
conductor project create \
  --name <name> \
  [--goal <text>]       # 项目目标描述
  [--work-dir <path>]   # 项目默认工作目录
  [--group <groupId>]   # 归属分组 id
  [--order <n>]         # 在分组内（或未分组列表中）的排序位置
  [--no-pin]            # 创建时设为 pinned=false（不固定显示）
  [--json]
```

**输出**：新建的 Project 对象。

---

#### `conductor project update <id>`

```bash
conductor project update <project-id> \
  [--name <name>]
  [--goal <text>]
  [--work-dir <path>]
  [--group <groupId>]   # 设置归属分组
  [--no-group]          # 移出分组（移到未分组）
  [--order <n>]         # 在分组内（或未分组列表中）的排序位置
  [--pin]               # 设为固定显示
  [--no-pin]            # 设为不固定显示（折叠到"更多"区）
  [--json]
```

**输出**：更新后的 Project 对象。

---

#### `conductor project delete <id>`

删除项目及其所有任务（级联删除）。

```bash
conductor project delete <project-id> [--json]
```

**输出**：`{ ok: true }`

---

#### `conductor project archive <id>` / `unarchive <id>`

归档 / 取消归档项目（不删除数据，仅标记）。

```bash
conductor project archive <project-id> [--json]
conductor project unarchive <project-id> [--json]
```

**输出**：更新后的 Project 对象。

---

#### `conductor project reorder-ungrouped`

重新排列未分组项目的顺序（按传入顺序设置 order）。

```bash
conductor project reorder-ungrouped <proj-id1> <proj-id2> ... [--json]
```

**输出**：`{ ok: true }`

---

### 分组

#### `conductor group list`

列出所有分组，每个分组附带其所属项目列表。

```bash
conductor group list [--json]
```

**输出**：ProjectGroup 数组（含 `projects` 字段）。

---

#### `conductor group get <id>`

获取单个分组（含所属项目列表）。

```bash
conductor group get <id> [--json]
```

**输出**：ProjectGroup 对象（含 `projects` 字段），找不到则报错退出。

---

#### `conductor group create`

创建分组。

```bash
conductor group create \
  --name "<name>" \
  [--collapsed]         # 默认折叠（不传则默认展开）
  [--created-by ai]     # AI 创建时传此参数
  [--json]
```

**输出**：新建的 ProjectGroup 对象。

---

#### `conductor group update <id>`

更新分组属性。

```bash
conductor group update <id> \
  [--name "新名称"] \
  [--collapse] \        # 设为默认折叠
  [--expand] \          # 设为默认展开
  [--json]
```

**输出**：更新后的 ProjectGroup 对象。

---

#### `conductor group delete <id>`

删除分组，分组内项目移到未分组（`groupId` 置 `null`）。

```bash
conductor group delete <id> [--json]
```

**输出**：`{ ok: true }`

---

#### `conductor group reorder`

重新排列分组顺序（按传入顺序设置 order）。

```bash
conductor group reorder <id1> <id2> ... [--json]
```

**输出**：`{ ok: true }`

---

#### `conductor group reorder-projects`

重新排列分组内项目的顺序（按传入顺序设置 order）。

```bash
conductor group reorder-projects <groupId> <proj-id1> <proj-id2> ... [--json]
```

**输出**：`{ ok: true }`

---

### 提示词

提示词分两层：**系统级**（全局生效）和**项目级**（覆盖系统级）。执行 AI 任务时，系统级 + 项目级 + 任务 executor.prompt 三层拼接后发送给 AI。

#### `conductor prompt get`

```bash
conductor prompt get [--project <project-id>] [--json]
```

不传 `--project` 时获取系统级 prompt；传 `--project` 时获取该项目的 prompt。

**输出**：SystemPrompt 对象 `{ key, content, updatedAt }`，未设置时返回空。

---

#### `conductor prompt set "<content>"`

```bash
conductor prompt set "你是一个专注于代码质量的 AI 助手..." [--project <project-id>]
```

不传 `--project` 时设置系统级 prompt；传 `--project` 时设置项目级 prompt（覆盖系统级）。

---

#### `conductor prompt delete`

```bash
conductor prompt delete [--project <project-id>] [--json]
```

删除项目级 prompt（恢复使用系统级）。不传 `--project` 时删除系统级 prompt。

---

### 鉴权

#### `conductor auth token`

生成访问令牌并启用 HTTP API 认证。令牌存储在 `~/.conductor/auth.json`（权限 600）。

```bash
conductor auth token
```

**输出**：生成的令牌字符串。首次运行后所有 `/api/*` 请求均需携带该令牌。

---

#### `conductor auth status`

检查当前是否已启用认证。

```bash
conductor auth status [--json]
```

**输出**：`enabled` 或 `disabled`；`--json` 时返回 `{ "enabled": true }`。

---

#### `conductor auth disable`

禁用认证（删除 `~/.conductor/auth.json`），之后所有请求无需令牌即可访问。

```bash
conductor auth disable
```

**输出**：`auth disabled`。

---

### 系统

#### `conductor daemon start`

启动后台 daemon（HTTP 服务 + 调度器），端口 7762。

```bash
conductor daemon start
```

daemon 启动后会：
1. 初始化 SQLite 数据库（`~/.conductor/db.sqlite`）
2. 将所有卡在 `running` 状态的任务恢复为 `pending`
3. 注册所有 enabled 的 scheduled/recurring 任务到调度器
4. 启动 HTTP 服务

---

#### `conductor daemon status`

检查 daemon 是否在运行。

```bash
conductor daemon status
```

**输出**：`running` 或 `stopped`。

---

#### `conductor info`

显示系统信息（数据库路径、版本等）。

```bash
conductor info [--json]
```

---

#### `conductor version`

显示版本号。

```bash
conductor version
```

---

## HTTP API

**Base URL**：`http://localhost:7762`  
**Content-Type**：`application/json`  
**认证**：启用认证后，所有 `/api/*` 路由均需携带令牌（见下方 Auth 章节）。未启用认证时可直接访问。

---

### Auth

#### `GET /auth/status`

检查当前是否已启用认证。**无需令牌，始终可访问**。

**响应** `200`：
```json
{ "enabled": true }
```

---

> **认证说明**：启用认证后（执行 `conductor auth token` 后），所有 `/api/*` 请求需通过以下任一方式传递令牌：
>
> | 方式 | 格式 |
> |------|------|
> | HTTP Header | `Authorization: Bearer <token>` |
> | Cookie | `conductor_token=<token>` |
> | 查询参数 | `?token=<token>`（适用于 SSE/EventSource） |
>
> 认证失败时返回 `401 { "error": "Unauthorized", "hint": "Pass token via Authorization: Bearer <token>" }`。  
> 详见 [auth.md](./auth.md)。

---

### Projects

#### `GET /api/projects`

列出所有项目（含已归档）。

**响应** `200`：Project 数组

```json
[
  {
    "id": "proj_a1b2c3",
    "name": "每日任务",
    "goal": "自动化日常工作",
    "workDir": "/Users/me/projects",
    "archived": false,
    "createdAt": "2026-04-01T10:00:00.000Z",
    "updatedAt": "2026-04-01T10:00:00.000Z"
  }
]
```

---

#### `POST /api/projects`

创建项目。

**请求体**：
```json
{
  "name": "新项目",          // 必填
  "goal": "项目目标",        // 可选
  "workDir": "~/projects/x"  // 可选
}
```

**响应** `201`：新建的 Project 对象  
**响应** `400`：`{ "error": "name is required" }`

---

#### `GET /api/projects/:id`

获取单个项目。

**响应** `200`：Project 对象  
**响应** `404`：`{ "error": "not found" }`

---

#### `PATCH /api/projects/:id`

更新项目，只需传要修改的字段。

**请求体**（所有字段可选）：
```json
{
  "name": "新名称",
  "goal": "新目标",
  "workDir": "~/new/path",
  "groupId": "group_xxx",   // 设置归属分组，null = 移出分组
  "order": 2,               // 在分组内（或未分组中）的排序位置
  "pinned": false           // 是否固定显示在侧边栏
}
```

**响应** `200`：更新后的 Project 对象  
**响应** `404`：`{ "error": "not found" }`

---

#### `DELETE /api/projects/:id`

删除项目及其所有任务（级联）。

**响应** `200`：`{ "ok": true }`  
**响应** `404`：`{ "error": "not found" }`

---

#### `POST /api/projects/:id/archive`

归档项目。

**响应** `200`：更新后的 Project 对象  
**响应** `404`：`{ "error": "not found" }`

---

#### `POST /api/projects/:id/unarchive`

取消归档。

**响应** `200`：更新后的 Project 对象  
**响应** `404`：`{ "error": "not found" }`

---

### View

#### `GET /api/view/projects`

返回 `ProjectsView`，前端侧边栏的主数据源。含分组（每个分组附带所属项目列表）和未分组项目。

**响应** `200`：ProjectsView 对象

```json
{
  "groups": [
    {
      "id": "group_a1b2c3",
      "name": "工作",
      "order": 0,
      "collapsed": false,
      "createdBy": "human",
      "createdAt": "...",
      "updatedAt": "...",
      "projects": [
        { "id": "proj_xxx", "name": "日常事务", "order": 0, "pinned": true, "archived": false, "createdAt": "...", "updatedAt": "..." },
        { "id": "proj_yyy", "name": "理财计划", "order": 1, "pinned": false, "archived": false, "createdAt": "...", "updatedAt": "..." }
      ]
    }
  ],
  "ungrouped": [
    { "id": "proj_zzz", "name": "测试", "order": 0, "pinned": true, "archived": false, "createdAt": "...", "updatedAt": "..." }
  ]
}
```

---

### Groups

#### `GET /api/groups`

列出所有分组，每个分组附带所属项目列表。

**响应** `200`：ProjectGroup 数组（含 `projects` 字段）

---

#### `POST /api/groups`

创建分组。

**请求体**：
```json
{
  "name": "工作",        // 必填
  "collapsed": false,    // 可选，默认 false
  "createdBy": "human"   // 可选，默认 "human"，AI 创建时传 "ai"
}
```

**响应** `201`：新建的 ProjectGroup 对象  
**响应** `400`：`{ "error": "name is required" }`

---

#### `GET /api/groups/:id`

获取单个分组（含所属项目列表）。

**响应** `200`：ProjectGroup 对象（含 `projects` 字段）  
**响应** `404`：`{ "error": "not found" }`

---

#### `PATCH /api/groups/:id`

更新分组属性，只需传要修改的字段。

**请求体**（所有字段可选）：
```json
{
  "name": "新名称",
  "collapsed": true
}
```

**响应** `200`：更新后的 ProjectGroup 对象  
**响应** `404`：`{ "error": "not found" }`

---

#### `DELETE /api/groups/:id`

删除分组，分组内项目 `groupId` 置 `null`（移到未分组）。

**响应** `200`：`{ "ok": true }`  
**响应** `404`：`{ "error": "not found" }`

---

#### `POST /api/groups/reorder`

重新排列分组顺序（拖拽后调用）。

**请求体**：
```json
{
  "ids": ["group_c", "group_a", "group_b"]
}
```

**响应** `200`：`{ "ok": true }`

---

#### `POST /api/groups/:id/projects/reorder`

重新排列分组内项目顺序（拖拽后调用）。

**请求体**：
```json
{
  "ids": ["proj_b", "proj_a", "proj_c"]
}
```

**响应** `200`：`{ "ok": true }`  
**响应** `404`：`{ "error": "not found" }`

---

#### `POST /api/ungrouped/reorder`

重新排列未分组项目顺序（拖拽后调用）。

**请求体**：
```json
{
  "ids": ["proj_z", "proj_y"]
}
```

**响应** `200`：`{ "ok": true }`

---

### Tasks

#### `GET /api/tasks`

列出任务，支持查询参数过滤。

**查询参数**（均可选）：
| 参数 | 说明 |
|------|------|
| `projectId` | 按项目过滤 |
| `kind` | `once` \| `scheduled` \| `recurring` |
| `status` | `pending` \| `running` \| `done` \| `failed` \| `cancelled` \| `blocked` |
| `assignee` | `ai` \| `human` |

**响应** `200`：Task 数组

---

#### `POST /api/tasks`

创建任务。

**请求体**：
```json
{
  "title": "每日晨报",           // 必填
  "projectId": "proj_a1b2c3",   // 必填
  "assignee": "ai",             // 可选，默认 "human"
  "kind": "recurring",          // 可选，默认 "once"
  "description": "生成每日摘要",  // 可选
  "order": 1,                   // 可选，展示排序

  "scheduleConfig": {           // kind = scheduled/recurring 时配置
    "kind": "recurring",
    "cron": "0 9 * * *"
  },

  "executor": {                 // assignee = ai 时配置
    "kind": "ai_prompt",
    "prompt": "总结今天的新闻，包含 {date} 的要点",
    "agent": "claude",
    "model": "claude-opus-4-5"
  },

  "executorOptions": {          // 可选
    "reviewOnComplete": false,
    "customVars": {
      "region": "cn-north"
    }
  },

  "dependsOn": "task_xyz",      // 可选，前置任务 id
  "enabled": true,              // 可选，默认 true
  "createdBy": "human",         // 可选，默认 "human"

  // human 任务专用
  "waitingInstructions": "请确认后运行 conductor task done <id>",
  "sourceTaskId": "task_abc"
}
```

**响应** `201`：新建的 Task 对象  
**响应** `400`：`{ "error": "title is required" }` 或 `{ "error": "projectId is required" }`

---

#### `GET /api/tasks/:id`

获取单个任务。

**响应** `200`：Task 对象  
**响应** `404`：`{ "error": "not found" }`

---

#### `PATCH /api/tasks/:id`

更新任务，只传需要修改的字段。更新调度配置后自动重新注册到调度器。

**请求体**（所有字段可选）：
```json
{
  "title": "新标题",
  "description": "新描述",
  "enabled": false,
  "scheduleConfig": {
    "kind": "recurring",
    "cron": "0 10 * * *"
  },
  "executor": {
    "kind": "ai_prompt",
    "prompt": "新的 prompt"
  },
  "executorOptions": {
    "reviewOnComplete": true
  }
}
```

**响应** `200`：更新后的 Task 对象  
**响应** `404`：`{ "error": "not found" }`

---

#### `DELETE /api/tasks/:id`

删除任务及其所有关联数据（logs、ops、runs、spool）。

**响应** `200`：`{ "ok": true }`  
**响应** `404`：`{ "error": "not found" }`

---

#### `POST /api/tasks/:id/run`

手动触发 AI 任务执行（异步，立即返回）。调用方通过轮询 `GET /api/tasks/:id` 或监听 SSE 事件跟踪进度。

**请求体**：无

**响应** `200`：`{ "ok": true, "taskId": "task_abc" }`  
**响应** `404`：`{ "error": "not found" }`

---

#### `POST /api/tasks/:id/done`

将 human 任务标记为完成，并自动解除阻塞等待该任务的 AI 任务。

**请求体**（可选）：
```json
{
  "output": "已确认预算，金额 5000 元"
}
```

`output` 会保存为 `completionOutput`，并注入为 `{lastOutput}` 传给被解锁的 AI 任务。

**响应** `200`：更新后的 human Task 对象  
**响应** `400`：`{ "error": "only human tasks can be marked done" }`  
**响应** `404`：`{ "error": "not found" }`

---

#### `POST /api/tasks/:id/cancel`

取消任务，状态改为 `cancelled`。

**请求体**：无

**响应** `200`：更新后的 Task 对象  
**响应** `404`：`{ "error": "not found" }`

---

#### `GET /api/tasks/:id/logs`

获取任务执行历史（每个任务最多保留 50 条，按时间倒序）。

**查询参数**：
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `limit` | 返回条数 | `20` |

**响应** `200`：TaskLog 数组  
**响应** `404`：`{ "error": "not found" }`

---

#### `GET /api/tasks/:id/ops`

获取任务操作审计记录（永久保留，按时间倒序）。

**查询参数**：
| 参数 | 说明 | 默认值 |
|------|------|--------|
| `limit` | 返回条数 | `20` |

**响应** `200`：TaskOp 数组  
**响应** `404`：`{ "error": "not found" }`

---

#### `GET /api/tasks/:id/runs`

获取任务的所有 AI 执行记录（每次 `run` 产生一条）。

**响应** `200`：TaskRun 数组

```json
[
  {
    "id": "run_d4e5f6",
    "taskId": "task_abc",
    "startedAt": "2026-04-15T09:00:01.000Z",
    "completedAt": "2026-04-15T09:00:45.000Z",
    "status": "done",
    "exitCode": 0,
    "sessionId": "sess_xxx"
  }
]
```

**响应** `404`：`{ "error": "not found" }`

---

#### `GET /api/tasks/:id/runs/:runId/spool`

获取某次执行的完整流式输出行（AI 执行时实时写入的 stdout/stderr 流）。

**响应** `200`：spool 行数组

```json
[
  { "id": 1, "runId": "run_d4e5f6", "line": "分析代码库...", "ts": "2026-04-15T09:00:02.000Z" },
  { "id": 2, "runId": "run_d4e5f6", "line": "发现 3 个问题", "ts": "2026-04-15T09:00:10.000Z" }
]
```

**响应** `404`：`{ "error": "task not found" }` 或 `{ "error": "run not found" }`

---

### Prompts

#### `GET /api/prompts/system`

获取系统级 prompt。

**响应** `200`：SystemPrompt 对象或 `null`

```json
{
  "key": "default",
  "content": "你是一个专注于代码质量的 AI 助手...",
  "updatedAt": "2026-04-10T08:00:00.000Z"
}
```

---

#### `PATCH /api/prompts/system`

设置或更新系统级 prompt。

**请求体**：
```json
{
  "content": "新的系统 prompt 内容"
}
```

**响应** `200`：更新后的 SystemPrompt 对象

---

#### `GET /api/prompts/project/:id`

获取项目级 prompt（覆盖系统级）。

**响应** `200`：SystemPrompt 对象或 `null`（未设置时返回 null）

---

#### `PATCH /api/prompts/project/:id`

设置或更新项目级 prompt。

**请求体**：
```json
{
  "content": "该项目专用 prompt，优先于系统级 prompt"
}
```

**响应** `200`：更新后的 SystemPrompt 对象

---

#### `DELETE /api/prompts/project/:id`

删除项目级 prompt，恢复使用系统级 prompt。

**响应** `200`：`{ "ok": true }`

---

### Events（SSE）

#### `GET /api/events`

建立 Server-Sent Events 长连接，实时接收任务状态变化和 AI 执行输出。

**查询参数**：
| 参数 | 说明 |
|------|------|
| `projectId` | 只接收该项目的事件（`run_line` 事件不受此过滤，始终推送） |

**连接后立即推送** `connected` 事件确认连接成功。每 30 秒发送一次 `: heartbeat` 保持连接。

**事件格式**：
```
data: {"type":"task_updated","data":{"taskId":"task_abc","projectId":"proj_xyz"}}

data: {"type":"run_line","data":{"taskId":"task_abc","runId":"run_d4e5f6","line":"执行中...","ts":"2026-04-15T09:00:02.000Z"}}
```

**事件类型**：

| 类型 | 触发时机 | data 字段 |
|------|----------|-----------|
| `connected` | 连接建立时 | `{}` |
| `task_created` | 任务被创建 | `{ taskId, projectId }` |
| `task_updated` | 任务状态或属性变更 | `{ taskId, projectId }` |
| `task_deleted` | 任务被删除 | `{ taskId, projectId }` |
| `run_line` | AI 执行产生一行输出 | `{ taskId, runId, line, ts }` |

**JavaScript 示例**：
```js
const es = new EventSource('http://localhost:7762/api/events?projectId=proj_abc')

es.onmessage = (e) => {
  const event = JSON.parse(e.data)
  if (event.type === 'run_line') {
    console.log('[AI]', event.data.line)
  }
  if (event.type === 'task_updated') {
    // 重新拉取任务状态
    fetchTask(event.data.taskId)
  }
}
```

---

### Health

#### `GET /health`

检查 daemon 是否正常运行。

**响应** `200`：`{ "ok": true }`
