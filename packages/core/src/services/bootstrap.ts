/**
 * bootstrap.ts
 *
 * Runs once on daemon startup (after initDb).
 * Ensures built-in projects and their seed tasks exist.
 * All operations are idempotent — safe to call on every restart.
 *
 * Two built-in projects:
 *   proj_conductor — system maintenance (cleanup, WAL checkpoint)
 *   proj_default   — user's default daily workspace (每日工作梳理)
 */

import { getDb } from '../db/init'
import { getProject } from '../models/projects'
import { getTask } from '../models/tasks'

// ─── Fixed IDs ────────────────────────────────────────────────────────────────

export const SYSTEM_PROJECT_ID  = 'proj_conductor'
export const DEFAULT_PROJECT_ID = 'proj_default'

// System maintenance tasks
const TASK_CLEAN_SPOOL    = 'task_sys_clean_spool'
const TASK_CLEAN_OPS      = 'task_sys_clean_ops'
const TASK_WAL_CHECKPOINT = 'task_sys_wal_checkpoint'

// Default project tasks
const TASK_DAILY_REVIEW   = 'task_default_daily_review'

// ─── Retention constants ──────────────────────────────────────────────────────

const SPOOL_MAX_LINES_PER_RUN = 20_000
const RUNS_MAX_PER_TASK       = 50
const OPS_RETAIN_DAYS         = 365

// ─── Inline scripts (self-contained bun -e scripts) ──────────────────────────

const SCRIPT_CLEAN_SPOOL = `
const { Database } = require('bun:sqlite');
const path = require('path');
const dbPath = process.env.CONDUCTOR_DB ?? path.join(process.env.HOME, '.conductor', 'db.sqlite');
const db = new Database(dbPath);
db.run('PRAGMA foreign_keys = ON');

const spoolResult = db.run(\`
  DELETE FROM task_run_spool
  WHERE id NOT IN (
    SELECT id FROM task_run_spool s2
    WHERE s2.run_id = task_run_spool.run_id
    ORDER BY id DESC
    LIMIT ${SPOOL_MAX_LINES_PER_RUN}
  )
\`);

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

db.run('PRAGMA wal_checkpoint(TRUNCATE)');
db.run('PRAGMA optimize');

const fs = require('fs');
const stats = fs.statSync(dbPath);
console.log('db size (bytes):', stats.size);
try {
  console.log('wal size (bytes):', fs.statSync(dbPath + '-wal').size);
} catch {
  console.log('wal size (bytes): 0');
}
db.close();
`.trim()

// Encode a script as base64 so it can be passed to `sh -c` without any
// quoting issues. The resulting command is:
//   bun -e "$(echo <b64> | base64 -d)"
function b64cmd(script: string): string {
  const b64 = Buffer.from(script).toString('base64')
  return `bun -e "$(echo ${b64} | base64 -d)"`
}

// ─── Seed definitions ─────────────────────────────────────────────────────────

interface SeedProject {
  id: string
  name: string
  goal: string
}

interface SeedTask {
  id: string
  projectId: string
  title: string
  description: string
  assignee: 'ai' | 'human'
  kind: 'once' | 'scheduled' | 'recurring'
  cron: string
  executorKind: 'script' | 'ai_prompt'
  executorConfig: Record<string, unknown>
}

const SEED_PROJECTS: SeedProject[] = [
  {
    id: SYSTEM_PROJECT_ID,
    name: 'Conductor',
    goal: '系统维护项目，负责自动清理运行时数据、优化数据库。由系统管理，不建议删除。',
  },
  {
    id: DEFAULT_PROJECT_ID,
    name: '日常事务',
    goal: '默认工作项目，记录日常任务和每日工作梳理。',
  },
]

const SEED_TASKS: SeedTask[] = [
  // ── Conductor system maintenance ──────────────────────────────────────────
  {
    id: TASK_CLEAN_SPOOL,
    projectId: SYSTEM_PROJECT_ID,
    title: '清理执行输出流水',
    description: `每个 run 保留最新 ${SPOOL_MAX_LINES_PER_RUN.toLocaleString()} 行 spool 数据；每个任务保留最近 ${RUNS_MAX_PER_TASK} 次执行记录，超出部分级联删除。`,
    assignee: 'ai',
    kind: 'recurring',
    cron: '0 3 * * *',    // 每天 03:00
    executorKind: 'script',
    executorConfig: { command: b64cmd(SCRIPT_CLEAN_SPOOL) },
  },
  {
    id: TASK_CLEAN_OPS,
    projectId: SYSTEM_PROJECT_ID,
    title: '清理操作审计记录',
    description: `删除 ${OPS_RETAIN_DAYS} 天前的 task_ops 记录，保留近一年的操作历史。`,
    assignee: 'ai',
    kind: 'recurring',
    cron: '30 3 * * 0',   // 每周日 03:30
    executorKind: 'script',
    executorConfig: { command: b64cmd(SCRIPT_CLEAN_OPS) },
  },
  {
    id: TASK_WAL_CHECKPOINT,
    projectId: SYSTEM_PROJECT_ID,
    title: 'WAL Checkpoint & 数据库优化',
    description: '执行 SQLite WAL checkpoint（截断模式）并运行 PRAGMA optimize，防止 WAL 文件无限膨胀。',
    assignee: 'ai',
    kind: 'recurring',
    cron: '0 4 * * *',    // 每天 04:00
    executorKind: 'script',
    executorConfig: { command: b64cmd(SCRIPT_WAL_CHECKPOINT) },
  },

  // ── Default project daily task ─────────────────────────────────────────────
  {
    id: TASK_DAILY_REVIEW,
    projectId: DEFAULT_PROJECT_ID,
    title: '每日工作梳理',
    description: '每天晚上 9 点自动运行，梳理当天完成的任务、记录进展、整理待办事项。',
    assignee: 'ai',
    kind: 'recurring',
    cron: '0 21 * * *',   // 每天 21:00
    executorKind: 'ai_prompt',
    executorConfig: {
      prompt: `今天是 {date}，请帮我梳理今天的工作情况：

1. 回顾今天完成了哪些事情（可以结合 {taskTitle} 和上下文）
2. 记录遇到的问题和解决方案
3. 整理明天需要跟进的事项
4. 给今天的工作状态打个分（1-10），并简短说明原因

请用简洁的中文输出，结构清晰。`,
    },
  },
]

// ─── Bootstrap ────────────────────────────────────────────────────────────────

export function bootstrap(): void {
  const db = getDb()
  const ts = new Date().toISOString()

  // 1. Ensure all seed projects exist
  for (const proj of SEED_PROJECTS) {
    if (!getProject(proj.id)) {
      // proj_conductor is pinned=false (background project, hidden from sidebar by default)
      const pinned = proj.id === SYSTEM_PROJECT_ID ? 0 : 1
      db.run(
        `INSERT INTO projects (id, name, goal, archived, pinned, created_by, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, 'system', ?, ?)`,
        [proj.id, proj.name, proj.goal, pinned, ts, ts],
      )
      console.log(`[bootstrap] created project: ${proj.name}`)
    }
  }

  // 2. Ensure all seed tasks exist (never overwrite — user may have customised them)
  for (const def of SEED_TASKS) {
    if (!getTask(def.id)) {
      db.run(
        `INSERT INTO tasks (
          id, project_id, title, description,
          assignee, kind, status,
          schedule_config, executor_kind, executor_config,
          enabled, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'recurring', 'pending', ?, ?, ?, 1, 'system', ?, ?)`,
        [
          def.id,
          def.projectId,
          def.title,
          def.description,
          def.assignee,
          JSON.stringify({ kind: 'recurring', cron: def.cron }),
          def.executorKind,
          JSON.stringify(def.executorConfig),
          ts,
          ts,
        ],
      )
      console.log(`[bootstrap] created task: ${def.title}`)
    }
  }
}
