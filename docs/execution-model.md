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
| `{lastOutput}` | 上次执行结果 | `includeLastOutput=true` 且有记录时 |
| 自定义 `{key}` | 用户自定义值 | `customVars` 里有定义时 |

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
```

### AI 任务（reviewOnComplete=true）

```
AI 任务执行完
  → status='done'
  → 写 task_logs
  → 写 task_ops
  → AI 创建 review 任务：
      assignee='human', kind='once', status='pending'
      projectId = 原任务的 projectId
      sourceTaskId = 原任务 id
  → 写 task_ops（op='review_created'）
```

---

## 等待任务 Callback 流转

```
1. AI 执行任务 A，遇到卡点
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
   → 任务 B：status='done', completionOutput='确认结果'
   → 任务 A：status='pending', completionOutput=task-B.completionOutput
   → 自动重新触发任务 A，上下文注入 completionOutput
```

---

## AI Provider 超时处理

- 执行超时：默认 300 秒（executor_config.timeout）
- 超时后：先发 SIGTERM，等 15 秒 grace period，再发 SIGKILL
- task_logs status = 'failed'，error = 'execution timeout'
- 写 task_ops：op='status_changed', note='execution timeout'
