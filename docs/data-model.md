# 数据模型

## Project

```typescript
interface Project {
  id: string           // 'proj_' + hex，不可变
  createdAt: string
  updatedAt: string

  name: string
  goal?: string        // 可选目标描述，注入 AI 上下文

  workDir?: string     // AI 执行任务时的工作目录
  systemPrompt?: string

  archived: boolean
  archivedAt?: string
}
```

---

## Task

`assignee` 和 `kind` 正交设计：
- `assignee` 决定**谁执行**
- `kind` 决定**怎么触发**

合法组合示例：

| assignee | kind | 场景 |
|---|---|---|
| human | once | 临时待办、AI 创建的卡点任务 |
| human | scheduled | 定时提醒（明天下午3点开会） |
| human | recurring | 周期打卡（每天喝水、每周复盘） |
| ai | once | 手动触发的 AI 任务 |
| ai | scheduled | 定时执行的 AI 任务 |
| ai | recurring | 周期执行的 AI 任务（每日晨报） |

```typescript
interface Task {
  id: string           // 'task_' + hex
  createdAt: string
  updatedAt: string

  projectId: string

  title: string
  description?: string

  assignee: 'ai' | 'human'
  kind: 'once' | 'scheduled' | 'recurring'
  status: TaskStatus

  order?: number       // 展示顺序（用户可拖拽排序）
  dependsOn?: string   // 前置任务 id，该任务 done 后本任务才触发

  scheduleConfig?: ScheduleConfig
  executor?: TaskExecutor
  executorOptions?: ExecutorOptions

  // human 任务
  waitingInstructions?: string
  sourceTaskId?: string

  // AI blocked/恢复
  blockedByTaskId?: string
  completionOutput?: string

  enabled: boolean
  createdBy: 'human' | 'ai'
}
```

### TaskStatus

```typescript
// 人类任务
type HumanTaskStatus = 'pending' | 'done' | 'cancelled'

// AI 任务
type AiTaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled' | 'blocked'
```

### 状态转移

**AI 任务：**
```
pending   → running    （调度器触发 / 手动 task run）
running   → done       （执行成功）
running   → failed     （执行失败）
running   → cancelled  （用户取消）
pending   → cancelled  （用户取消）
failed    → pending    （手动 task run 重试）
cancelled → pending    （手动 task run 重试）
pending   → blocked    （AI 创建等待任务，自己阻塞自己）
blocked   → pending    （等待任务完成或取消，自动解除）
```

**人类任务：**
```
pending → done       （checkbox 勾选 / conductor task done）
pending → cancelled  （conductor task cancel）
```

### ScheduleConfig

```typescript
interface ScheduledConfig {
  kind: 'scheduled'
  scheduledAt: string   // ISO 8601，必须是未来时间
}

interface RecurringConfig {
  kind: 'recurring'
  cron: string
  timezone?: string
  lastRunAt?: string
  nextRunAt?: string
}
```

### TaskExecutor

```typescript
interface ScriptExecutor {
  kind: 'script'
  command: string
  workDir?: string      // 默认 project.workDir
  env?: Record<string, string>
  timeout?: number      // 秒，默认 300
}

interface AiPromptExecutor {
  kind: 'ai_prompt'
  prompt: string        // 支持占位符
  tool?: string
  model?: string
}

interface HttpExecutor {
  kind: 'http'
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: string
  timeout?: number
}
```

### ExecutorOptions

```typescript
interface ExecutorOptions {
  includeLastOutput?: boolean           // 注入上次执行结果到 {lastOutput}
  customVars?: Record<string, string>   // 自定义占位符变量
  reviewOnComplete?: boolean            // 执行完创建人类 review 任务
}
```

---

## TaskLog

```typescript
interface TaskLog {
  id: string
  taskId: string
  startedAt: string
  completedAt?: string
  status: 'success' | 'failed' | 'cancelled' | 'skipped'
  output?: string       // 截断至 64KB
  error?: string
  triggeredBy: 'manual' | 'scheduler' | 'api' | 'cli'
  skipReason?: string
}
```

保留策略：每个任务最近 50 条。

---

## TaskOps

```typescript
interface TaskOp {
  id: string
  taskId: string        // 任务删除后仍保留（永久保留）
  op: TaskOpKind
  fromStatus?: string
  toStatus?: string
  actor: 'human' | 'ai' | 'scheduler'
  note?: string
  createdAt: string
}

type TaskOpKind =
  | 'created'
  | 'triggered'
  | 'status_changed'
  | 'done'
  | 'cancelled'
  | 'review_created'
  | 'unblocked'
  | 'deleted'
```
