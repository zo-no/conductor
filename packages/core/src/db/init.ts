import { Database } from 'bun:sqlite'
import { homedir } from 'os'
import { mkdirSync } from 'fs'
import { join } from 'path'

const CONDUCTOR_DIR = join(homedir(), '.conductor')
const DB_PATH = join(CONDUCTOR_DIR, 'db.sqlite')

let _db: Database | null = null

export function getDb(): Database {
  if (_db) return _db
  mkdirSync(CONDUCTOR_DIR, { recursive: true })
  _db = new Database(DB_PATH, { create: true })
  _db.run('PRAGMA journal_mode = WAL')
  _db.run('PRAGMA foreign_keys = ON')
  return _db
}

export function initDb(): void {
  const db = getDb()

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id            TEXT PRIMARY KEY NOT NULL,
      name          TEXT NOT NULL,
      goal          TEXT,
      work_dir      TEXT,
      system_prompt TEXT,
      archived      INTEGER NOT NULL DEFAULT 0,
      archived_at   TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    ) STRICT
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id                   TEXT PRIMARY KEY NOT NULL,
      project_id           TEXT NOT NULL REFERENCES projects(id),
      title                TEXT NOT NULL,
      description          TEXT,
      assignee             TEXT NOT NULL DEFAULT 'human',
      kind                 TEXT NOT NULL DEFAULT 'once',
      status               TEXT NOT NULL DEFAULT 'pending',
      order_index          INTEGER,
      depends_on           TEXT REFERENCES tasks(id),
      schedule_config      TEXT,
      executor_kind        TEXT,
      executor_config      TEXT,
      executor_options     TEXT,
      waiting_instructions TEXT,
      source_task_id       TEXT REFERENCES tasks(id),
      blocked_by_task_id   TEXT REFERENCES tasks(id),
      completion_output    TEXT,
      enabled              INTEGER NOT NULL DEFAULT 1,
      created_by           TEXT NOT NULL DEFAULT 'human',
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL
    ) STRICT
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_project  ON tasks(project_id, status, updated_at DESC)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee, kind, status)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_source   ON tasks(source_task_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_blocked  ON tasks(blocked_by_task_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_depends  ON tasks(depends_on)`)

  db.run(`
    CREATE TABLE IF NOT EXISTS task_logs (
      id           TEXT PRIMARY KEY NOT NULL,
      task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      status       TEXT NOT NULL,
      triggered_by TEXT NOT NULL,
      output       TEXT,
      error        TEXT,
      skip_reason  TEXT,
      started_at   TEXT NOT NULL,
      completed_at TEXT
    ) STRICT
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(task_id, started_at DESC)`)

  db.run(`
    CREATE TABLE IF NOT EXISTS task_ops (
      id          TEXT PRIMARY KEY NOT NULL,
      task_id     TEXT NOT NULL,
      op          TEXT NOT NULL,
      from_status TEXT,
      to_status   TEXT,
      actor       TEXT NOT NULL,
      note        TEXT,
      created_at  TEXT NOT NULL
    ) STRICT
  `)

  db.run(`CREATE INDEX IF NOT EXISTS idx_task_ops_task    ON task_ops(task_id, created_at DESC)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_task_ops_created ON task_ops(created_at DESC)`)

  db.run(`
    CREATE TABLE IF NOT EXISTS system_prompts (
      key        TEXT PRIMARY KEY NOT NULL,
      content    TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY NOT NULL,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT
  `)
}
