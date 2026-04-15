# 已决策项

| 项目 | 决策 |
|---|---|
| 定位 | 本地优先的任务调度引擎，给人类和 AI 一起用的 todolist + agent 调度器 |
| 数据存储 | `~/.conductor/db.sqlite` |
| HTTP 端口 | 默认 7762 |
| Project 字段 | id + name + goal（可选）+ workDir（可选）+ systemPrompt（可选） |
| Project 层级 | 不支持层级，扁平结构 |
| 内置项目 | 无，用户自己创建 |
| Task assignee/kind | 两个字段正交：assignee 决定谁执行，kind 决定触发方式 |
| 人类任务 status | pending / done / cancelled |
| AI 任务 status | pending / running / done / failed / cancelled / blocked |
| 上下文注入 | 系统自动注入：date, datetime, taskTitle, taskDescription, projectName；用户选择：lastOutput, customVars |
| goal/workDir 注入 | 不作为内置占位符，用户需要用 customVars 自己定义 |
| 提示词层级 | 系统级 → 项目级 → 任务级 |
| 调度器实现 | 进程内 croner + 内存 job registry + 启动时 reconcile |
| 错过的调度任务 | 丢弃，记录 skipped，不补跑 |
| dependsOn | 前置任务未 done 时跳过执行，记录 skipped |
| 执行超时 | 默认 300 秒，SIGTERM + 15s grace + SIGKILL |
| 执行日志大小 | 截断至 64KB |
| 任务日志保留 | 每个任务最近 50 条 |
| task_ops 保留 | 永久保留，任务删除时不级联 |
| reconcile 策略 | 启动时把 running 任务重置为 pending |
| scheduled 时间校验 | scheduledAt < now 时拒绝创建 |
| reviewOnComplete | ExecutorOptions 字段，执行完自动创建人类 review 任务 |
| human-in-the-loop | 支持，AI 创建 human 任务阻塞自己，人类完成后自动恢复 |
| CLI 认证 | 不需要，直接操作本地 SQLite |
| HTTP 认证 | 一期不做，本地工具默认信任 |
| 外部项目接入方式 | 两种方式：HTTP API（适合服务端集成）或 CLI（适合本地脚本/AI 调用），详见 [integration.md](integration.md) |
