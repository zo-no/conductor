# Conductor 架构概览

## 它是什么

Conductor 是一个**本地优先的 todo list、任务系统、任务调度系统**。

它允许**人类和 AI 一起编写任务**，并把任务**派给人类或 AI** 去执行。

核心不是对话本身，而是任务的创建、指派、调度、执行、跟踪和恢复。

三个核心目的：
- 把**人类任务和 AI 任务集中记录在同一个地方**
- 让任务执行完成后留下**可追踪的日志和操作历史**
- 让一个 Project 内的任务集合逐步沉淀成可迭代的**工作流**

核心原则：
- **Project** 是任务的上下文边界，不是复杂的组织树，扁平结构
- **Task** 是唯一的执行单元，人类和 AI 共用同一个 todo list
- **assignee** 决定任务派给谁执行：`human` 或 `ai`
- **本地 SQLite** 是系统事实来源（`~/.conductor/db.sqlite`）
- **调度、执行、审计** 是核心能力，界面和接入方式是外围能力

---

## 系统边界

三个包：

- `@conductor/core` — 本地核心服务，负责存储、调度、执行、HTTP API、CLI
- `@conductor/types` — 共享类型定义
- `@conductor/web` — 面向人类用户的 Web UI

面向不同使用者的入口：
- **人类**：主要通过 Web UI 管理和处理任务
- **Agent**：主要通过 CLI 读写任务、推进任务执行
- **外部系统**：主要通过 HTTP API 调用

所有入口操作同一个任务系统，核心写操作同时提供 CLI 和 HTTP API 两个版本。

---

## 核心对象

### ProjectGroup

项目的**分组容器**。把一组相关项目归在一起，侧边栏按分组展示，支持折叠/展开。

字段：`id`（`group_` + hex）、`name`、`order`（展示顺序）、`collapsed`（默认是否折叠）、`createdBy`

### Project

任务的**上下文边界**。把一组相关任务放在一起，提供共享上下文（工作目录、系统 prompt）。

约束：
- 每个 Task 必须归属一个 Project
- 扁平结构，不支持层级
- 归档后任务仍保留，只是不在默认视图里显示

字段：`id`（`proj_` + hex）、`name`、`goal`（可选）、`workDir`（AI 执行默认目录）、`archived`、`groupId`（可选，所属分组）、`order`（分组内或未分组列表中的排序）、`pinned`（是否固定显示在侧边栏，默认 `true`）

### Task

系统唯一的执行单元。两个正交维度：

- `assignee`：谁执行 — `human` | `ai`
- `kind`：怎么触发 — `once` | `scheduled` | `recurring`

| assignee | kind | 场景 |
|---|---|---|
| human | once | 临时待办、AI 创建的卡点任务 |
| human | scheduled | 定时提醒 |
| human | recurring | 周期打卡 |
| ai | once | 手动触发的 AI 任务 |
| ai | scheduled | 定时执行的 AI 任务 |
| ai | recurring | 周期执行的 AI 任务 |

**AI 任务状态转移：**
```
pending   → running    （调度器触发 / 手动 run）
running   → done       （执行成功）
running   → failed     （执行失败）
running   → cancelled  （用户取消）
pending   → cancelled  （用户取消）
failed    → pending    （重试）
cancelled → pending    （重试）
pending   → blocked    （AI 创建等待任务，阻塞自己）
blocked   → pending    （等待任务完成，自动解除）
```

**人类任务状态转移：**
```
pending → done       （勾选完成）
pending → cancelled  （取消）
```

### TaskRun

每次 AI 任务执行对应一条记录。存储 `sessionId`（agent 对话 session ID），用于下次执行时 resume 对话。`task_run_spool` 存储逐行输出，用于前端实时展示。

### TaskLog

一次执行尝试的结果：成功/失败/跳过、输出、报错。每个任务保留最近 200 条，任务删除时级联删除。输出截断至 64KB。

### TaskOp

任务状态变化和关键操作的审计日志：谁触发、从什么状态到什么状态。保留最近 365 天（由系统维护任务定期清理）。

`op` 类型：`created` | `triggered` | `status_changed` | `done` | `cancelled` | `review_created` | `unblocked` | `deleted`

---

## 运行形态

单机、本地进程、单库。启动顺序：

```
initDb → bootstrap → reconcile → startScheduler → startServer
```

- `initDb`：建表、执行 schema migration
- `bootstrap`：幂等初始化内置项目和预置任务（见下方）
- `reconcile`：把 running 任务重置为 pending（应对异常退出）
- `startScheduler`：注册所有 scheduled/recurring 任务的 cron job
- `startServer`：HTTP API 监听 7762 端口

## 内置项目

系统启动时自动创建两个内置项目（`created_by = 'system'`），幂等，用户可见可操作：

### Conductor（`proj_conductor`）

> `pinned = false`（后台项目，默认不固定显示在侧边栏）

系统维护项目，预置 3 个周期任务，用产品自身的调度机制管理自身的运行时数据：

| 任务 | 执行时间 | 作用 |
|------|----------|------|
| 清理执行输出流水 | 每天 03:00 | 每个 run 保留最新 20,000 行 spool；每个 task 保留最近 50 次 run |
| 清理操作审计记录 | 每周日 03:30 | 删除 365 天前的 task_ops |
| WAL Checkpoint & 优化 | 每天 04:00 | SQLite WAL 截断 + PRAGMA optimize |

### 日常事务（`proj_default`）

用户的默认工作项目，预置 1 个周期任务：

| 任务 | 执行时间 | 作用 |
|------|----------|------|
| 每日工作梳理 | 每天 21:00 | AI 自动梳理当天工作进展、问题、明日待办 |

所有预置任务均可被用户修改（调整 cron、禁用、修改 prompt）。重启不会覆盖用户的修改。

---

## 分层结构

```
db/          存储层    初始化 SQLite，建表，提供连接
models/      Model 层  纯数据操作，不依赖 HTTP/CLI，不持有状态
services/    Service 层 调度、执行、事件推送
controllers/ Interface 层
  http/      HTTP API（Hono）
  cli/       CLI（Commander）
web/         Web UI（React）
```

Model 层是最稳定的一层，回答"怎么读写事实"。Service 层是调度引擎，承载系统行为。Interface 层只做参数解析和格式化输出，不承载业务规则。

---

## 底层主线

**Task state machine + local scheduler + execution adapters + audit trail**

1. **Task state machine** — 状态流转清晰，`pending/running/done/failed/blocked/cancelled`
2. **Local scheduler** — 本地进程负责 `scheduled` 和 `recurring` 任务的触发与恢复
3. **Execution adapters** — AI（claude/codex）、脚本、HTTP 都是执行器，消费同一个状态机
4. **Audit trail** — `task_logs` 和 `task_ops` 是可追踪系统的基础设施

---

## 文档导航

- 执行模型（session、调度、prompt）→ [execution-model.md](execution-model.md)
- CLI & HTTP API 参考 → [cli-api.md](cli-api.md)
- UI 设计 → [ui-design.md](ui-design.md)
- 外部接入 → [integration.md](integration.md)
