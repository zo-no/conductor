import { randomBytes } from 'crypto'
import type { Project } from '@conductor/types'
import { getDb } from '../db/init'

export const DEFAULT_PROJECT_ID = 'proj_default'

function newId(): string {
  return 'proj_' + randomBytes(6).toString('hex')
}

function now(): string {
  return new Date().toISOString()
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    goal: (row.goal as string) ?? undefined,
    workDir: (row.work_dir as string) ?? undefined,
    archived: row.archived === 1,
    archivedAt: (row.archived_at as string) ?? undefined,
    createdBy: (row.created_by as 'human' | 'system') ?? 'human',
    pinned: row.pinned !== 0,
    groupId: (row.group_id as string) ?? undefined,
    order: (row.order_index as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function listProjects(): Project[] {
  const db = getDb()
  const rows = db.query('SELECT * FROM projects ORDER BY created_at DESC').all() as Record<string, unknown>[]
  return rows.map(rowToProject)
}

export function getProject(id: string): Project | null {
  const db = getDb()
  const row = db.query('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | null
  return row ? rowToProject(row) : null
}

export interface CreateProjectInput {
  name: string
  goal?: string
  workDir?: string
  groupId?: string
  pinned?: boolean
}

export function createProject(input: CreateProjectInput): Project {
  const db = getDb()
  const id = newId()
  const ts = now()
  // Place at end of its group (or ungrouped list)
  let maxRow: { m: number | null }
  if (input.groupId) {
    maxRow = db.query('SELECT MAX(order_index) as m FROM projects WHERE group_id = ?').get(input.groupId) as { m: number | null }
  } else {
    maxRow = db.query('SELECT MAX(order_index) as m FROM projects WHERE group_id IS NULL').get() as { m: number | null }
  }
  const order = (maxRow?.m ?? -1) + 1
  db.run(
    `INSERT INTO projects (id, name, goal, work_dir, archived, group_id, order_index, pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    [id, input.name, input.goal ?? null, input.workDir ?? null,
     input.groupId ?? null, order, input.pinned !== false ? 1 : 0, ts, ts],
  )
  return getProject(id)!
}

export interface UpdateProjectInput {
  name?: string
  goal?: string
  workDir?: string
  pinned?: boolean
  groupId?: string | null
  order?: number
}

export function updateProject(id: string, input: UpdateProjectInput): Project | null {
  const db = getDb()
  const project = getProject(id)
  if (!project) return null

  const ts = now()
  const fields: string[] = ['updated_at = ?']
  const params: unknown[] = [ts]

  if (input.name !== undefined)    { fields.push('name = ?');        params.push(input.name) }
  if (input.goal !== undefined)    { fields.push('goal = ?');        params.push(input.goal ?? null) }
  if (input.workDir !== undefined) { fields.push('work_dir = ?');    params.push(input.workDir ?? null) }
  if (input.pinned !== undefined)  { fields.push('pinned = ?');      params.push(input.pinned ? 1 : 0) }
  if ('groupId' in input)          { fields.push('group_id = ?');    params.push(input.groupId ?? null) }
  if (input.order !== undefined)   { fields.push('order_index = ?'); params.push(input.order) }

  params.push(id)
  db.run(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, params)
  return getProject(id)!
}

export function archiveProject(id: string): Project | null {
  const db = getDb()
  const ts = now()
  const result = db.run(
    'UPDATE projects SET archived = 1, archived_at = ?, updated_at = ? WHERE id = ?',
    [ts, ts, id],
  )
  if (result.changes === 0) return null
  return getProject(id)!
}

export function unarchiveProject(id: string): Project | null {
  const db = getDb()
  const ts = now()
  const result = db.run(
    'UPDATE projects SET archived = 0, archived_at = NULL, updated_at = ? WHERE id = ?',
    [ts, id],
  )
  if (result.changes === 0) return null
  return getProject(id)!
}

export function isDefaultProject(id: string): boolean {
  return id === DEFAULT_PROJECT_ID
}

export function deleteProject(id: string): boolean {
  const db = getDb()
  // Delete tasks first (task_logs cascade from tasks, task_ops have no FK)
  db.run('DELETE FROM tasks WHERE project_id = ?', [id])
  db.run('DELETE FROM system_prompts WHERE key = ?', [`proj_${id}`])
  const result = db.run('DELETE FROM projects WHERE id = ?', [id])
  return result.changes > 0
}
