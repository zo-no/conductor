import { randomBytes } from 'crypto'
import type { ProjectGroup, ProjectsView } from '@conductor/types'
import { getDb } from '../db/init'
import { listProjects } from './projects'

function newId(): string {
  return 'group_' + randomBytes(6).toString('hex')
}

function now(): string {
  return new Date().toISOString()
}

function rowToGroup(row: Record<string, unknown>): ProjectGroup {
  return {
    id: row.id as string,
    name: row.name as string,
    order: row.order_index as number,
    collapsed: row.collapsed === 1,
    createdBy: (row.created_by as 'human' | 'ai' | 'system') ?? 'human',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function listGroups(): ProjectGroup[] {
  const db = getDb()
  const rows = db.query('SELECT * FROM project_groups ORDER BY order_index ASC').all() as Record<string, unknown>[]
  return rows.map(rowToGroup)
}

export function getGroup(id: string): ProjectGroup | null {
  const db = getDb()
  const row = db.query('SELECT * FROM project_groups WHERE id = ?').get(id) as Record<string, unknown> | null
  return row ? rowToGroup(row) : null
}

export interface CreateGroupInput {
  name: string
  collapsed?: boolean
  createdBy?: 'human' | 'ai' | 'system'
}

export function createGroup(input: CreateGroupInput): ProjectGroup {
  const db = getDb()
  const id = newId()
  const ts = now()
  // Place at end
  const maxRow = db.query('SELECT MAX(order_index) as m FROM project_groups').get() as { m: number | null }
  const order = (maxRow.m ?? -1) + 1
  db.run(
    `INSERT INTO project_groups (id, name, order_index, collapsed, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, order, input.collapsed ? 1 : 0, input.createdBy ?? 'human', ts, ts],
  )
  return getGroup(id)!
}

export interface UpdateGroupInput {
  name?: string
  collapsed?: boolean
}

export function updateGroup(id: string, input: UpdateGroupInput): ProjectGroup | null {
  const db = getDb()
  const group = getGroup(id)
  if (!group) return null
  const ts = now()
  db.run(
    `UPDATE project_groups SET name = ?, collapsed = ?, updated_at = ? WHERE id = ?`,
    [
      input.name ?? group.name,
      input.collapsed !== undefined ? (input.collapsed ? 1 : 0) : (group.collapsed ? 1 : 0),
      ts,
      id,
    ],
  )
  return getGroup(id)!
}

export function deleteGroup(id: string): boolean {
  const db = getDb()
  // Move all projects in this group to ungrouped
  db.run(`UPDATE projects SET group_id = NULL, updated_at = ? WHERE group_id = ?`, [now(), id])
  const result = db.run('DELETE FROM project_groups WHERE id = ?', [id])
  return result.changes > 0
}

/** Reorder groups: accept ordered array of all group ids, assign order_index 0,1,2... */
export function reorderGroups(orderedIds: string[]): void {
  const db = getDb()
  const ts = now()
  for (let i = 0; i < orderedIds.length; i++) {
    db.run(`UPDATE project_groups SET order_index = ?, updated_at = ? WHERE id = ?`, [i, ts, orderedIds[i]])
  }
}

/** Reorder projects within a group (or ungrouped when groupId is null) */
export function reorderProjectsInGroup(groupId: string | null, orderedIds: string[]): void {
  const db = getDb()
  const ts = now()
  for (let i = 0; i < orderedIds.length; i++) {
    if (groupId === null) {
      db.run(
        `UPDATE projects SET order_index = ?, updated_at = ? WHERE id = ? AND group_id IS NULL`,
        [i, ts, orderedIds[i]],
      )
    } else {
      db.run(
        `UPDATE projects SET order_index = ?, updated_at = ? WHERE id = ? AND group_id = ?`,
        [i, ts, orderedIds[i], groupId],
      )
    }
  }
}

/** Build the full ProjectsView (groups with nested projects + ungrouped) */
export function getProjectsView(): ProjectsView {
  const groups = listGroups()
  const allProjects = listProjects()

  const groupsWithProjects = groups.map(g => ({
    ...g,
    projects: allProjects
      .filter(p => p.groupId === g.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  }))

  const ungrouped = allProjects
    .filter(p => !p.groupId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return { groups: groupsWithProjects, ungrouped }
}
