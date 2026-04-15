/**
 * bootstrap.ts
 *
 * Runs once on daemon startup (after initDb).
 * Ensures the built-in "Conductor" system project and its maintenance tasks exist.
 * All operations are idempotent — safe to call on every restart.
 */

import { getDb } from '../db/init'
import { getProject } from '../models/projects'
import { getTask, createTask, updateTask } from '../models/tasks'

// ─── Fixed IDs ────────────────────────────────────────────────────────────────

export const SYSTEM_PROJECT_ID = 'proj_conductor'

const TASK_CLEAN_SPOOL    = 'task_sys_clean_spool'
const TASK_CLEAN_OPS      = 'task_sys_clean_ops'
const TASK_WAL_CHECKPOINT = 'task_sys_wal_checkpoint'

// ─── Retention constants (mirrored in scripts below) ─────────────────────────

// These match what the scripts actually delete — keep in sync if you change them.
const SPOOL_MAX_LINES_PER_RUN = 20_000
const RUNS_MAX_PER_TASK       = 50
const OPS_RETAIN_DAYS         = 365

// ─── Inline bun scripts ───────────────────────────────────────────────────────

// Each script is self-contained: opens the DB, runs cleanup, prints a summary.
// They use CONDUCTOR_DB env var (set by the executor) so they work regardless
// of where bun is invoked from.

const SCRIPT_CLEAN_SPOOL = `
const { Database } = require('bun:sqlite');
const path = require('path');
const dbPath = process.env.CONDUCTOR_DB ?? path.join(process.env.HOME, '.conductor', 'db.sqlite');
const db = new Database(dbPath);
db.run('PRAGMA foreign_keys = ON');

// 1. Delete spool lines beyond the per-run cap (keep newest ${SPOOL_MAX_LINES_PER_RUN})
const spoolResult = db.run(\`
  DELETE FROM task_run_spool
  WHERE id NOT IN (
    SELECT id FROM task_run_spool s2
    WHERE s2.run_id = task_run_spool.run_id
    ORDER BY id DESC
    LIMIT ${SPOOL_MAX_LINES_PER_RUN}
  )
\`);

// 2. Delete runs beyond per-task cap (keep newest ${RUNS_MAX_PER_TASK}); cascade removes their spool
const runsResult = db.run(\`
  DELETE FROM task_runs
  WHERE id NOT IN (
    SELECT id FROM task_runs r2
    WHERE r2.task_id = task_runs.task_id
    ORDER BY started_at DESC
    LIMIT ${RUNS_MAX_PER_TASK}
  )
\`);

console.log('spool lines removed:', spoolResult.changes);
console.log('old runs removed:', runsResult.changes);
db.close();
`.trim()

const SCRIPT_CLEAN_OPS = `
const { Database } = require('bun:sqlite');
const path = require('path');
const dbPath = process.env.CONDUCTOR_DB ?? path.join(process.env.HOME, '.conductor', 'db.sqlite');
const db = new Database(dbPath);
db.run('PRAGMA foreign_keys = ON');

// Delete task_ops older than ${OPS_RETAIN_DAYS} days
const result = db.run(
  "DELETE FROM task_ops WHERE created_at < datetime('now', '-${OPS_RETAIN_DAYS} days')"
);

console.log('old ops removed:', result.changes);
db.close();
`.trim()

const SCRIPT_WAL_CHECKPOINT = `
const { Database } = require('bun:sqlite');
const path = require('path');
const dbPath = process.env.CONDUCTOR_DB ?? path.join(process.env.HOME, '.conductor', 'db.sqlite');
const db = new Database(dbPath);

// Truncate WAL back to near-zero and run optimizer
db.run('PRAGMA wal_checkpoint(TRUNCATE)');
db.run('PRAGMA optimize');

// Report DB file size
const fs = require('fs');
const stats = fs.statSync(dbPath);
console.log('db size (bytes):', stats.size);

try {
  const walStats = fs.statSync(dbPath + '-wal');
  console.log('wal size (bytes):', walStats.size);
} catch {
  console.log('wal size (bytes): 0');
}

db.close();
`.trim()

// ─── Task definitions ─────────────────────────────────────────────────────────

interface MaintTask {
  id: string
  title: string
  description: string
  cron: string
  script: string
}

const MAINT_TASKS: MaintTask[] = [
  {
    id: TASK_CLEAN_SPOOL,
    title: '清理执行输出流水',
    description: `每个 run 保留最新 ${SPOOL_MAX_LINES_PER_RUN.toLocaleString()} 行 spool 数据；每个任务保留最近 ${RUNS_MAX_PER_TASK} 次执行记录，超出部分级联删除。`,
    cron: '0 3 * * *',   // 每天 03:00
    script: SCRIPT_CLEAN_SPOOL,
  },
  {
    id: TASK_CLEAN_OPS,
    title: '清理操作审计记录',
    description: `删除 ${OPS_RETAIN_DAYS} 天前的 task_ops 记录，保留近一年的操作历史。`,
    cron: '30 3 * * 0',  // 每周日 03:30
    script: SCRIPT_CLEAN_OPS,
  },
  {
    id: TASK_WAL_CHECKPOINT,
    title: 'WAL Checkpoint & 数据库优化',
    description: '执行 SQLite WAL checkpoint（截断模式）并运行 PRAGMA optimize，防止 WAL 文件无限膨胀。',
    cron: '0 4 * * *',   // 每天 04:00
    script: SCRIPT_WAL_CHECKPOINT,
  },
]

// ─── Bootstrap ────────────────────────────────────────────────────────────────

export function bootstrap(): void {
  const db = getDb()
  const ts = new Date().toISOString()

  // 1. Ensure system project exists
  const project = getProject(SYSTEM_PROJECT_ID)
  if (!project) {
    db.run(
      `INSERT INTO projects (id, name, goal, archived, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 0, 'system', ?, ?)`,
      [
        SYSTEM_PROJECT_ID,
        'Conductor',
        '系统维护项目，负责自动清理运行时数据、优化数据库。',
        ts,
        ts,
      ],
    )
    console.log('[bootstrap] created system project')
  }

  // 2. Ensure each maintenance task exists (upsert by fixed id)
  for (const def of MAINT_TASKS) {
    const existing = getTask(def.id)

    if (!existing) {
      // Insert with fixed id directly via SQL (createTask generates a random id)
      db.run(
        `INSERT INTO tasks (
          id, project_id, title, description,
          assignee, kind, status,
          schedule_config, executor_kind, executor_config,
          enabled, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'ai', 'recurring', 'pending', ?, 'script', ?, 1, 'system', ?, ?)`,
        [
          def.id,
          SYSTEM_PROJECT_ID,
          def.title,
          def.description,
          JSON.stringify({ kind: 'recurring', cron: def.cron }),
          JSON.stringify({ command: `bun -e '${def.script.replace(/'/g, "\\'")}'` }),
          ts,
          ts,
        ],
      )
      console.log(`[bootstrap] created maintenance task: ${def.title}`)
    }
    // If task exists, leave it alone — user may have adjusted cron or disabled it
  }
}
