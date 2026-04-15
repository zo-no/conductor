import { randomBytes } from 'crypto'
import type { TaskLog } from '@conductor/types'
import { getDb } from '../db/init'

const MAX_OUTPUT_BYTES = 64 * 1024 // 64KB
const MAX_LOGS_PER_TASK = 50

function newId(): string {
  return 'log_' + randomBytes(6).toString('hex')
}

function now(): string {
  return new Date().toISOString()
}

function truncate(text: string): string {
  if (Buffer.byteLength(text, 'utf8') <= MAX_OUTPUT_BYTES) return text
  return Buffer.from(text, 'utf8').slice(0, MAX_OUTPUT_BYTES).toString('utf8') + '\n[truncated]'
}

function rowToLog(row: Record<string, unknown>): TaskLog {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) ?? undefined,
    status: row.status as TaskLog['status'],
    output: (row.output as string) ?? undefined,
    error: (row.error as string) ?? undefined,
    triggeredBy: row.triggered_by as TaskLog['triggeredBy'],
    skipReason: (row.skip_reason as string) ?? undefined,
  }
}

export function getTaskLogs(taskId: string, limit = 20): TaskLog[] {
  const db = getDb()
  const rows = db.query(
    'SELECT * FROM task_logs WHERE task_id = ? ORDER BY started_at DESC LIMIT ?',
  ).all(taskId, limit) as Record<string, unknown>[]
  return rows.map(rowToLog)
}

export interface CreateTaskLogInput {
  taskId: string
  status: TaskLog['status']
  triggeredBy: TaskLog['triggeredBy']
  output?: string
  error?: string
  skipReason?: string
  startedAt?: string
  completedAt?: string
}

export function createTaskLog(input: CreateTaskLogInput): TaskLog {
  const db = getDb()
  const id = newId()
  const startedAt = input.startedAt ?? now()

  db.run(
    `INSERT INTO task_logs (id, task_id, status, triggered_by, output, error, skip_reason, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.taskId,
      input.status,
      input.triggeredBy,
      input.output ? truncate(input.output) : null,
      input.error ?? null,
      input.skipReason ?? null,
      startedAt,
      input.completedAt ?? null,
    ],
  )

  // 保留最近 50 条
  db.run(
    `DELETE FROM task_logs WHERE task_id = ? AND id NOT IN (
       SELECT id FROM task_logs WHERE task_id = ? ORDER BY started_at DESC LIMIT ?
     )`,
    [input.taskId, input.taskId, MAX_LOGS_PER_TASK],
  )

  return rowToLog(db.query('SELECT * FROM task_logs WHERE id = ?').get(id) as Record<string, unknown>)
}

export function updateTaskLogCompleted(
  id: string,
  status: TaskLog['status'],
  output?: string,
  error?: string,
): void {
  const db = getDb()
  db.run(
    `UPDATE task_logs SET status = ?, output = ?, error = ?, completed_at = ? WHERE id = ?`,
    [
      status,
      output ? truncate(output) : null,
      error ?? null,
      now(),
      id,
    ],
  )
}
