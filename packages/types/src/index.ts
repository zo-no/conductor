// ProjectGroup

export interface ProjectGroup {
  id: string           // 'group_' + hex
  name: string
  order: number        // sidebar display order
  collapsed: boolean   // default collapsed state in sidebar
  createdBy: 'human' | 'ai' | 'system'
  createdAt: string
  updatedAt: string
}

export interface GroupWithProjects extends ProjectGroup {
  projects: Project[]
}

export interface ProjectsView {
  groups: GroupWithProjects[]
  ungrouped: Project[]
}

// Project

export interface Project {
  id: string           // 'proj_' + hex
  createdAt: string
  updatedAt: string

  name: string
  goal?: string        // 可选目标描述
  workDir?: string     // AI 执行任务时的工作目录

  archived: boolean
  archivedAt?: string
  createdBy?: 'human' | 'system'  // 'system' = built-in, hidden from normal UI
  pinned: boolean                 // false = collapsed to "more" section in sidebar
  groupId?: string                // null = ungrouped
  order: number                   // order within group (or ungrouped list)
}

// Task

export type TaskAssignee = 'ai' | 'human'
export type TaskKind = 'once' | 'scheduled' | 'recurring'

export type HumanTaskStatus = 'pending' | 'done' | 'cancelled'
export type AiTaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled' | 'blocked'
export type TaskStatus = HumanTaskStatus | AiTaskStatus

export interface Task {
  id: string           // 'task_' + hex
  createdAt: string
  updatedAt: string

  projectId: string

  title: string
  description?: string

  assignee: TaskAssignee
  kind: TaskKind
  status: TaskStatus

  order?: number       // 展示顺序

  // 调度配置（kind=scheduled/recurring 时有效）
  scheduleConfig?: ScheduleConfig

  // 执行器（assignee=ai 时有效）
  executor?: TaskExecutor
  executorOptions?: ExecutorOptions

  // human 任务字段
  waitingInstructions?: string  // AI 写给人类的完成说明
  sourceTaskId?: string         // 来自哪个 AI 任务（卡点场景）

  // AI 等待/恢复字段
  blockedByTaskId?: string
  completionOutput?: string

  enabled: boolean
  createdBy: 'human' | 'ai'
  lastSessionId?: string   // 最近一次执行的 agent session ID，用于 continueSession
}

// Schedule

export interface ScheduledConfig {
  kind: 'scheduled'
  scheduledAt: string
}

export interface RecurringConfig {
  kind: 'recurring'
  cron: string
  timezone?: string
  lastRunAt?: string
  nextRunAt?: string
}

export type ScheduleConfig = ScheduledConfig | RecurringConfig

// Executor

export interface ScriptExecutor {
  kind: 'script'
  command: string
  workDir?: string
  env?: Record<string, string>
  timeout?: number     // 秒，默认 300
}

export type AgentKind = 'claude' | 'codex'

export interface AiPromptExecutor {
  kind: 'ai_prompt'
  prompt: string
  agent?: AgentKind   // 使用哪个 agent CLI，默认 'claude'
  model?: string
}

export interface HttpExecutor {
  kind: 'http'
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: string
  timeout?: number
}

export type TaskExecutor = ScriptExecutor | AiPromptExecutor | HttpExecutor

export interface VoiceNoticeOptions {
  enabled: boolean
  speechText?: string  // 留空则用默认文案："{taskTitle} 已完成" / "{taskTitle} 执行失败"
}

export interface ExecutorOptions {
  continueSession?: boolean                // resume 上次对话 session（默认 false）
  customVars?: Record<string, string>      // 用户自定义占位符变量
  reviewOnComplete?: boolean               // 执行完创建人类 review 任务
  voiceNotice?: VoiceNoticeOptions         // 执行完播报语音通知
}

// TaskLog

export interface TaskLog {
  id: string
  taskId: string
  startedAt: string
  completedAt?: string
  status: 'success' | 'failed' | 'cancelled' | 'skipped'
  output?: string      // stdout + stderr，截断至 64KB
  error?: string
  triggeredBy: 'manual' | 'scheduler' | 'api' | 'cli'
  skipReason?: string
}

// TaskOps

export type TaskOpKind =
  | 'created'
  | 'triggered'
  | 'status_changed'
  | 'done'
  | 'cancelled'
  | 'review_created'
  | 'unblocked'
  | 'deleted'

export interface TaskOp {
  id: string
  taskId: string
  op: TaskOpKind
  fromStatus?: string
  toStatus?: string
  actor: 'human' | 'ai' | 'scheduler'
  note?: string
  createdAt: string
}

// System Prompt

export interface SystemPrompt {
  key: string          // 'default' | 'proj_<id>'
  content: string
  updatedAt: string
}
