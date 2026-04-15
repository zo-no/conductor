# 数据库 Schema（SQLite）

数据存储位置：`~/.conductor/db.sqlite`

---

## projects 表

```sql
CREATE TABLE projects (
  id           TEXT PRIMARY KEY NOT NULL,
  name         TEXT NOT NULL,
  goal         TEXT,
  work_dir     TEXT,
  system_prompt TEXT,   -- 项目级 prompt（直接存在项目上，供 UI 读写）
  archived     INTEGER NOT NULL DEFAULT 0,
  archived_at  TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
) STRICT;
```

> `system_prompt` 字段和 `system_prompts` 表的关系见 [execution-model.md](execution-model.md)。

---

## tasks 表

```sql
CREATE TABLE tasks (
  id                   TEXT PRIMARY KEY NOT NULL,
  project_id           TEXT NOT NULL REFERENCES projects(id),
  title                TEXT NOT NULL,
  description          TEXT,

  -- 'ai' | 'human'
  assignee             TEXT NOT NULL DEFAULT 'human',

  -- 'once' | 'scheduled' | 'recurring'
  kind                 TEXT NOT NULL DEFAULT 'once',

  -- human: 'pending' | 'done' | 'cancelled'
  -- ai:    'pending' | 'running' | 'done' | 'failed' | 'cancelled' | 'blocked'
  status               TEXT NOT NULL DEFAULT 'pending',

  order_index          INTEGER,
  depends_on           TEXT REFERENCES tasks(id),

  -- 调度配置（JSON）
  schedule_config      TEXT,

  -- 执行器（JSON）
  executor_kind        TEXT,   -- 'script' | 'ai_prompt' | 'http'
  executor_config      TEXT,   -- JSON
  executor_options     TEXT,   -- JSON { includeLastOutput, customVars, reviewOnComplete }

  -- human 任务
  waiting_instructions TEXT,
  source_task_id       TEXT REFERENCES tasks(id),

  -- AI blocked/恢复
  blocked_by_task_id   TEXT REFERENCES tasks(id),
  completion_output    TEXT,

  enabled              INTEGER NOT NULL DEFAULT 1,
  created_by           TEXT NOT NULL DEFAULT 'human',

  -- session 连续性
  last_session_id      TEXT,   -- 最近一次执行的 agent session ID（快速查询缓存）

  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
) STRICT;

CREATE INDEX idx_tasks_project  ON tasks(project_id, status, updated_at DESC);
CREATE INDEX idx_tasks_assignee ON tasks(assignee, kind, status);
CREATE INDEX idx_tasks_source   ON tasks(source_task_id);
CREATE INDEX idx_tasks_blocked  ON tasks(blocked_by_task_id);
CREATE INDEX idx_tasks_depends  ON tasks(depends_on);
```

---

## task_logs 表

任务删除时**级联删除**，每个任务保留最近 50 条。

```sql
CREATE TABLE task_logs (
  id           TEXT PRIMARY KEY NOT NULL,
  task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status       TEXT NOT NULL,   -- 'success' | 'failed' | 'cancelled' | 'skipped'
  triggered_by TEXT NOT NULL,   -- 'manual' | 'scheduler' | 'api' | 'cli'
  output       TEXT,            -- stdout + stderr，截断至 64KB
  error        TEXT,
  skip_reason  TEXT,
  started_at   TEXT NOT NULL,
  completed_at TEXT
) STRICT;

CREATE INDEX idx_task_logs_task ON task_logs(task_id, started_at DESC);
```

---

## task_ops 表

**永久保留**，任务删除时不级联删除。

```sql
CREATE TABLE task_ops (
  id          TEXT PRIMARY KEY NOT NULL,
  task_id     TEXT NOT NULL,   -- 不加 REFERENCES，任务删除后仍保留
  op          TEXT NOT NULL,   -- 见 TaskOpKind
  from_status TEXT,
  to_status   TEXT,
  actor       TEXT NOT NULL,   -- 'human' | 'ai' | 'scheduler'
  note        TEXT,
  created_at  TEXT NOT NULL
) STRICT;

CREATE INDEX idx_task_ops_task    ON task_ops(task_id, created_at DESC);
CREATE INDEX idx_task_ops_created ON task_ops(created_at DESC);
```

---

## task_runs 表

每次 AI 任务执行对应一条记录，任务删除时级联删除。

```sql
CREATE TABLE task_runs (
  id           TEXT PRIMARY KEY NOT NULL,
  task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'done' | 'failed' | 'cancelled'
  triggered_by TEXT NOT NULL,
  session_id   TEXT,   -- agent session ID（claude UUID / codex UUID），用于 resume
  started_at   TEXT NOT NULL,
  completed_at TEXT,
  error        TEXT
) STRICT;

CREATE INDEX idx_task_runs_task ON task_runs(task_id, started_at DESC);
```

---

## task_run_spool 表

存储 AI 执行时的逐行输出（claude CLI 的 stream-json 输出），用于前端实时展示。任务运行记录删除时级联删除。

```sql
CREATE TABLE task_run_spool (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id  TEXT NOT NULL REFERENCES task_runs(id) ON DELETE CASCADE,
  ts      TEXT NOT NULL,
  line    TEXT NOT NULL
) STRICT;

CREATE INDEX idx_spool_run ON task_run_spool(run_id, id ASC);
```

---

## system_prompts 表

```sql
CREATE TABLE system_prompts (
  key        TEXT PRIMARY KEY NOT NULL,  -- 'default' | 'proj_<id>'
  content    TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
```

---

## settings 表

通用键值存储，用于持久化运行时配置。当前未使用，预留扩展。

```sql
CREATE TABLE settings (
  key        TEXT PRIMARY KEY NOT NULL,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
```
