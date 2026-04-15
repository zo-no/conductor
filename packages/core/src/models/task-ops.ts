import { randomBytes } from 'crypto'
import type { TaskOp, TaskOpKind } from '@conductor/types'
import { getDb } from '../db/init'

function newId(): string {
  return 'op_' + randomBytes(6).toString('hex')
}

function now(): string {
  return new Date().toISOString()
}

function rowToOp(row: Record<string, unknown>): TaskOp {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    op: row.op as TaskOpKind,
    fromStatus: (row.from_status as string) ?? undefined,
    toStatus: (row.to_status as string) ?? undefined,
    actor: row.actor as TaskOp['actor'],
    note: (row.note as string) ?? undefined,
    createdAt: row.created_at as string,
  }
}

export function getTaskOps(taskId: string, limit = 20): TaskOp[] {
  const db = getDb()
  const rows = db.query(
    'SELECT * FROM task_ops WHERE task_id = ? ORDER BY created_at DESC LIMIT ?',
  ).all(taskId, limit) as Record<string, unknown>[]
  return rows.map(rowToOp)
}

export interface CreateTaskOpInput {
  taskId: string
  op: TaskOpKind
  fromStatus?: string
  toStatus?: string
  actor: TaskOp['actor']
  note?: string
}

export function createTaskOp(input: CreateTaskOpInput): TaskOp {
  const db = getDb()
  const id = newId()
  const ts = now()

  db.run(
    `INSERT INTO task_ops (id, task_id, op, from_status, to_status, actor, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.taskId,
      input.op,
      input.fromStatus ?? null,
      input.toStatus ?? null,
      input.actor,
      input.note ?? null,
      ts,
    ],
  )

  return rowToOp(db.query('SELECT * FROM task_ops WHERE id = ?').get(id) as Record<string, unknown>)
}
