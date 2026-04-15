import { randomBytes } from 'crypto'
import { getDb } from '../db/init'

export interface TaskRun {
  id: string
  taskId: string
  status: 'running' | 'done' | 'failed' | 'cancelled'
  triggeredBy: 'manual' | 'scheduler' | 'api' | 'cli'
  startedAt: string
  completedAt?: string
  error?: string
}

export interface SpoolLine {
  id: number
  runId: string
  ts: string
  line: string
}

function newId(): string {
  return 'run_' + randomBytes(6).toString('hex')
}

function now(): string {
  return new Date().toISOString()
}

function rowToRun(row: Record<string, unknown>): TaskRun {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    status: row.status as TaskRun['status'],
    triggeredBy: row.triggered_by as TaskRun['triggeredBy'],
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) ?? undefined,
    error: (row.error as string) ?? undefined,
  }
}

export function createRun(taskId: string, triggeredBy: TaskRun['triggeredBy']): TaskRun {
  const db = getDb()
  const id = newId()
  const ts = now()
  db.run(
    `INSERT INTO task_runs (id, task_id, status, triggered_by, started_at) VALUES (?, ?, 'running', ?, ?)`,
    [id, taskId, triggeredBy, ts],
  )
  return rowToRun(db.query('SELECT * FROM task_runs WHERE id = ?').get(id) as Record<string, unknown>)
}

export function completeRun(id: string, status: 'done' | 'failed' | 'cancelled', error?: string): void {
  const db = getDb()
  db.run(
    `UPDATE task_runs SET status = ?, completed_at = ?, error = ? WHERE id = ?`,
    [status, now(), error ?? null, id],
  )
}

export function getRun(id: string): TaskRun | null {
  const db = getDb()
  const row = db.query('SELECT * FROM task_runs WHERE id = ?').get(id) as Record<string, unknown> | null
  return row ? rowToRun(row) : null
}

export function listRuns(taskId: string): TaskRun[] {
  const db = getDb()
  const rows = db.query(
    'SELECT * FROM task_runs WHERE task_id = ? ORDER BY started_at DESC',
  ).all(taskId) as Record<string, unknown>[]
  return rows.map(rowToRun)
}

export function appendSpoolLine(runId: string, line: string): void {
  const db = getDb()
  db.run(
    `INSERT INTO task_run_spool (run_id, ts, line) VALUES (?, ?, ?)`,
    [runId, now(), line],
  )
}

export function getSpoolLines(runId: string): SpoolLine[] {
  const db = getDb()
  return db.query(
    'SELECT * FROM task_run_spool WHERE run_id = ? ORDER BY id ASC',
  ).all(runId) as SpoolLine[]
}
