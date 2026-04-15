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
}

export function createProject(input: CreateProjectInput): Project {
  const db = getDb()
  const id = newId()
  const ts = now()
  db.run(
    `INSERT INTO projects (id, name, goal, work_dir, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [id, input.name, input.goal ?? null, input.workDir ?? null, ts, ts],
  )
  return getProject(id)!
}

export interface UpdateProjectInput {
  name?: string
  goal?: string
  workDir?: string
}

export function updateProject(id: string, input: UpdateProjectInput): Project | null {
  const db = getDb()
  const project = getProject(id)
  if (!project) return null

  const ts = now()
  db.run(
    `UPDATE projects SET name = ?, goal = ?, work_dir = ?, updated_at = ? WHERE id = ?`,
    [
      input.name ?? project.name,
      input.goal !== undefined ? input.goal : (project.goal ?? null),
      input.workDir !== undefined ? input.workDir : (project.workDir ?? null),
      ts,
      id,
    ],
  )
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
