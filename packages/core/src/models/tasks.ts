import { randomBytes } from 'crypto'
import type {
  Task, TaskAssignee, TaskKind, TaskStatus,
  ScheduleConfig, TaskExecutor, ExecutorOptions,
} from '@conductor/types'
import { getDb } from '../db/init'

function newId(): string {
  return 'task_' + randomBytes(6).toString('hex')
}

function now(): string {
  return new Date().toISOString()
}

function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    description: (row.description as string) ?? undefined,
    assignee: row.assignee as TaskAssignee,
    kind: row.kind as TaskKind,
    status: row.status as TaskStatus,
    order: (row.order_index as number) ?? undefined,
    scheduleConfig: row.schedule_config
      ? JSON.parse(row.schedule_config as string) as ScheduleConfig
      : undefined,
    executor: row.executor_kind && row.executor_config
      ? { kind: row.executor_kind, ...JSON.parse(row.executor_config as string) } as TaskExecutor
      : undefined,
    executorOptions: row.executor_options
      ? JSON.parse(row.executor_options as string) as ExecutorOptions
      : undefined,
    waitingInstructions: (row.waiting_instructions as string) ?? undefined,
    sourceTaskId: (row.source_task_id as string) ?? undefined,
    blockedByTaskId: (row.blocked_by_task_id as string) ?? undefined,
    completionOutput: (row.completion_output as string) ?? undefined,
    enabled: row.enabled === 1,
    createdBy: row.created_by as 'human' | 'ai',
    lastSessionId: (row.last_session_id as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export interface ListTasksFilter {
  projectId?: string
  kind?: TaskKind
  status?: TaskStatus
  assignee?: TaskAssignee
}

export function listTasks(filter: ListTasksFilter = {}): Task[] {
  const db = getDb()
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter.projectId) { conditions.push('project_id = ?'); params.push(filter.projectId) }
  if (filter.kind)      { conditions.push('kind = ?');       params.push(filter.kind) }
  if (filter.status)    { conditions.push('status = ?');     params.push(filter.status) }
  if (filter.assignee)  { conditions.push('assignee = ?');   params.push(filter.assignee) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.query(`SELECT * FROM tasks ${where} ORDER BY order_index ASC, created_at DESC`).all(...params) as Record<string, unknown>[]
  return rows.map(rowToTask)
}

export function getTask(id: string): Task | null {
  const db = getDb()
  const row = db.query('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | null
  return row ? rowToTask(row) : null
}

export interface CreateTaskInput {
  projectId: string
  title: string
  description?: string
  assignee: TaskAssignee
  kind: TaskKind
  order?: number
  scheduleConfig?: ScheduleConfig
  executor?: TaskExecutor
  executorOptions?: ExecutorOptions
  waitingInstructions?: string
  sourceTaskId?: string
  enabled?: boolean
  createdBy?: 'human' | 'ai'
}

export function createTask(input: CreateTaskInput): Task {
  const db = getDb()
  const id = newId()
  const ts = now()

  let executorKind: string | null = null
  let executorConfig: string | null = null
  if (input.executor) {
    const { kind, ...rest } = input.executor
    executorKind = kind
    executorConfig = JSON.stringify(rest)
  }

  db.run(
    `INSERT INTO tasks (
      id, project_id, title, description, assignee, kind, status,
      order_index, schedule_config,
      executor_kind, executor_config, executor_options,
      waiting_instructions, source_task_id,
      enabled, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.projectId,
      input.title,
      input.description ?? null,
      input.assignee,
      input.kind,
      input.order ?? null,
      input.scheduleConfig ? JSON.stringify(input.scheduleConfig) : null,
      executorKind,
      executorConfig,
      input.executorOptions ? JSON.stringify(input.executorOptions) : null,
      input.waitingInstructions ?? null,
      input.sourceTaskId ?? null,
      input.enabled !== false ? 1 : 0,
      input.createdBy ?? 'human',
      ts,
      ts,
    ],
  )
  return getTask(id)!
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  status?: TaskStatus
  scheduleConfig?: ScheduleConfig
  executor?: TaskExecutor
  executorOptions?: ExecutorOptions
  enabled?: boolean
  completionOutput?: string
  blockedByTaskId?: string | null
  lastSessionId?: string | null
}

export function updateTask(id: string, input: UpdateTaskInput): Task | null {
  const db = getDb()
  const task = getTask(id)
  if (!task) return null

  const ts = now()
  const fields: string[] = ['updated_at = ?']
  const params: unknown[] = [ts]

  if (input.title !== undefined)           { fields.push('title = ?');             params.push(input.title) }
  if (input.description !== undefined)     { fields.push('description = ?');       params.push(input.description) }
  if (input.status !== undefined)          { fields.push('status = ?');            params.push(input.status) }
  if (input.enabled !== undefined)         { fields.push('enabled = ?');           params.push(input.enabled ? 1 : 0) }
  if (input.completionOutput !== undefined){ fields.push('completion_output = ?');  params.push(input.completionOutput) }
  if ('blockedByTaskId' in input)          { fields.push('blocked_by_task_id = ?'); params.push(input.blockedByTaskId ?? null) }
  if ('lastSessionId' in input)            { fields.push('last_session_id = ?');    params.push(input.lastSessionId ?? null) }

  if (input.scheduleConfig !== undefined) {
    fields.push('schedule_config = ?')
    params.push(JSON.stringify(input.scheduleConfig))
  }
  if (input.executor !== undefined) {
    const { kind, ...rest } = input.executor
    fields.push('executor_kind = ?', 'executor_config = ?')
    params.push(kind, JSON.stringify(rest))
  }
  if (input.executorOptions !== undefined) {
    fields.push('executor_options = ?')
    params.push(JSON.stringify(input.executorOptions))
  }

  params.push(id)
  db.run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, params)
  return getTask(id)!
}

export function deleteTask(id: string): boolean {
  const db = getDb()
  // Clear self-referencing foreign keys and delete atomically to avoid partial state on failure
  const tx = db.transaction(() => {
    db.run(`UPDATE tasks SET source_task_id = NULL WHERE source_task_id = ?`, [id])
    db.run(`UPDATE tasks SET blocked_by_task_id = NULL WHERE blocked_by_task_id = ?`, [id])
    return db.run('DELETE FROM tasks WHERE id = ?', [id])
  })
  return tx().changes > 0
}

/** 查找所有 blockedByTaskId = id 且 status = blocked 的任务 */
export function getBlockedByTask(blockedByTaskId: string): Task[] {
  const db = getDb()
  const rows = db.query(
    "SELECT * FROM tasks WHERE blocked_by_task_id = ? AND status = 'blocked'",
  ).all(blockedByTaskId) as Record<string, unknown>[]
  return rows.map(rowToTask)
}

/** 启动时 reconcile：把 running 任务重置为 pending */
export function reconcileRunningTasks(): Task[] {
  const db = getDb()
  const ts = now()
  const rows = db.query("SELECT * FROM tasks WHERE status = 'running'").all() as Record<string, unknown>[]
  if (rows.length === 0) return []
  db.run(`UPDATE tasks SET status = 'pending', updated_at = ? WHERE status = 'running'`, [ts])
  return rows.map(rowToTask)
}
