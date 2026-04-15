import type { SystemPrompt } from '@conductor/types'
import { getDb } from '../db/init'

function now(): string {
  return new Date().toISOString()
}

function rowToPrompt(row: Record<string, unknown>): SystemPrompt {
  return {
    key: row.key as string,
    content: row.content as string,
    updatedAt: row.updated_at as string,
  }
}

export function getSystemPrompt(key: string): SystemPrompt | null {
  const db = getDb()
  const row = db.query('SELECT * FROM system_prompts WHERE key = ?').get(key) as Record<string, unknown> | null
  return row ? rowToPrompt(row) : null
}

export function setSystemPrompt(key: string, content: string): SystemPrompt {
  const db = getDb()
  const ts = now()
  db.run(
    `INSERT INTO system_prompts (key, content, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
    [key, content, ts],
  )
  return getSystemPrompt(key)!
}

export function deleteSystemPrompt(key: string): boolean {
  const db = getDb()
  const result = db.run('DELETE FROM system_prompts WHERE key = ?', [key])
  return result.changes > 0
}

export function getDefaultPrompt(): SystemPrompt | null {
  return getSystemPrompt('default')
}

export function getProjectPromptKey(projectId: string): string {
  return `proj_${projectId}`
}
