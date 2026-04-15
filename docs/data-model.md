# 数据模型

> 类型定义见 [`packages/types/src/index.ts`](../packages/types/src/index.ts)，本文档只记录设计意图和约束。

---

## Project

字段：`id`（`proj_` + hex，不可变）、`name`、`goal`（可选）、`workDir`（AI 执行任务的默认目录）、`archived`。

> `goal` 和 `workDir` 不直接注入占位符，需要通过 `customVars` 使用。

---

## Task

`assignee` 和 `kind` 正交设计：
- `assignee` 决定**谁执行**
- `kind` 决定**怎么触发**

合法组合示例：

| assignee | kind | 场景 |
|---|---|---|
| human | once | 临时待办、AI 创建的卡点任务 |
| human | scheduled | 定时提醒（明天下午3点开会） |
| human | recurring | 周期打卡（每天喝水、每周复盘） |
| ai | once | 手动触发的 AI 任务 |
| ai | scheduled | 定时执行的 AI 任务 |
| ai | recurring | 周期执行的 AI 任务（每日晨报） |

### 状态转移

**AI 任务：**
```
pending   → running    （调度器触发 / 手动 task run）
running   → done       （执行成功）
running   → failed     （执行失败）
running   → cancelled  （用户取消）
pending   → cancelled  （用户取消）
failed    → pending    （手动 task run 重试）
cancelled → pending    （手动 task run 重试）
pending   → blocked    （AI 创建等待任务，自己阻塞自己）
blocked   → pending    （等待任务完成或取消，自动解除）
```

**人类任务：**
```
pending → done       （checkbox 勾选 / conductor task done）
pending → cancelled  （conductor task cancel）
```

---

### TaskRun

每次 AI 任务执行对应一条 `task_run` 记录，包含：
- `sessionId`：本次执行产生的 agent session ID（claude/codex 各自的格式）
- `status`：`running` | `done` | `failed` | `cancelled`
- `triggeredBy`：触发来源

`task_runs` 和 `task_run_spool`（逐行输出）任务删除时级联删除。

---

## TaskLog

每个任务保留最近 **50 条**，任务删除时级联删除。

`triggeredBy`：`manual` | `scheduler` | `api` | `cli`

---

## TaskOps

**永久保留**，任务删除时不级联删除（用于审计）。

`op` 类型：`created` | `triggered` | `status_changed` | `done` | `cancelled` | `review_created` | `unblocked` | `deleted`
