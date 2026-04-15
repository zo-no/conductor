# 执行模型

## 提示词三层架构

`ai_prompt` executor 执行时，提示词按以下顺序组装：

```
系统级 prompt（system_prompts 表，key='default'）
  ↓ 追加
项目级 prompt（system_prompts 表，key='proj_<id>'）
  ↓ 追加
任务级 prompt（executor_config.prompt）
```

占位符在整个组装完的字符串上统一做 replaceAll。

---

## 上下文注入

| 占位符 | 内容 | 注入条件 |
|---|---|---|
| `{date}` | 当前日期 YYYY-MM-DD | 始终注入 |
| `{datetime}` | 当前时间 ISO 8601 含时区 | 始终注入 |
| `{taskTitle}` | 当前任务标题 | 始终注入 |
| `{taskDescription}` | 当前任务描述 | 有值时注入 |
| `{projectName}` | 项目名称 | 始终注入 |
| `{lastOutput}` | 上次执行的最后一段 assistant 文本 | `continueSession=false` 且有记录时可用 |
| 自定义 `{key}` | 用户自定义值 | `customVars` 里有定义时 |

> `goal` 和 `workDir` 不作为内置占位符，需要通过 `customVars` 自己定义。

---

## 对话历史（Session）

AI 任务的每次执行本质上是一次 agent 对话。通过 session 机制，可以让任务的多次执行在同一个对话上下文里连续进行，而不是每次从头开始。

### continueSession 开关

`executorOptions.continueSession`（默认 `false`）：

- `false`：每次执行开启新对话，互相独立
- `true`：每次执行 resume 上次的对话，保留完整历史

开启后，executor 会取 `task.lastSessionId`，用对应 CLI 的 resume 机制接续对话。

### 各 Agent 的 resume 方式

| agent | 首次执行 | resume |
|---|---|---|
| `claude` | `claude -p "..." --output-format stream-json` | `claude --resume <sessionId> -p "..." --output-format stream-json` |
| `codex` | `codex exec "..." --json` | `codex exec resume <sessionId> "..." --json` |

session ID 从每次执行的输出流中提取，存入 `task_runs.session_id`，同时更新 `tasks.last_session_id`。

### human-in-the-loop 的对话接续

blocked 任务解除后，自动 resume 上次 session，把人类的回答作为新 prompt 传入：

```
1. AI 任务 A 执行，产生 session_abc，遇到卡点
   → 创建 human 任务 B，任务 A blocked
   → task_runs 记录 session_id = "session_abc"

2. 人类完成任务 B，填写 output "预算已批，50 万"

3. 系统解除 A 的 blocked，重新执行：
   claude --resume session_abc -p "人类已确认：预算已批，50 万，请继续"

4. AI 在原对话上下文里继续，知道之前做了什么
```

---

## 调度器设计

- `scheduled`：到达 `scheduledAt` 时触发一次，执行后 status='done'
- `recurring`：按 cron 触发，执行完更新 `lastRunAt/nextRunAt`，status 保持 'pending'
- **错过处理**：不补跑，记录 `skipped` 日志，下次 cron 正常触发
- **重启后**：不回头触发，下次 cron 时间正常触发
- **并发保护**：同一任务上次还在 running，跳过本次，记录 `skipped`
- **dependsOn**：前置任务未 done 时，跳过执行，记录 `skipped`

启动顺序：`initDb → reconcileTasks → startScheduler → startServer`

reconcile 策略：启动时把 running 任务重置为 pending，写 task_ops 记录。

---

## 任务执行完成流程

### AI 任务（reviewOnComplete=false）

```
AI 任务执行完
  → status='done'
  → 写 task_logs
  → 写 task_ops（op='status_changed', from='running', to='done'）
  → 更新 task.lastSessionId
```

### AI 任务（reviewOnComplete=true）

```
AI 任务执行完
  → status='done'
  → 写 task_logs
  → 写 task_ops
  → 更新 task.lastSessionId
  → AI 创建 review 任务：
      assignee='human', kind='once', status='pending'
      projectId = 原任务的 projectId
      sourceTaskId = 原任务 id
  → 写 task_ops（op='review_created'）
```

---

## 等待任务 Callback 流转

```
1. AI 执行任务 A，遇到卡点，当前 session = session_abc
2. AI 调用：
   conductor task create \
     --title "需要确认" \
     --project <id> \
     --assignee human \
     --kind once \
     --instructions "请确认后运行：conductor task done <id> --output '结果'" \
     --source-task <task-A-id>
   → 创建人类任务 B
   → 任务 A：status='blocked', blockedByTaskId=task-B-id

3. 人类完成任务 B：
   conductor task done <task-B-id> --output "确认结果"

4. 系统 callback：
   → 任务 B：status='done'
   → 任务 A：status='pending'
   → 自动 resume session_abc，prompt = "人类已确认：确认结果，请继续"
```

---

## AI Provider 超时处理

- 执行超时：默认 300 秒（executor_config.timeout）
- 超时后：先发 SIGTERM，等 15 秒 grace period，再发 SIGKILL
- task_logs status = 'failed'，error = 'execution timeout'
- 写 task_ops：op='status_changed', note='execution timeout'
