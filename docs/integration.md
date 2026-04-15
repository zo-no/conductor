# 外部项目接入 Conductor

外部项目（AI 工具、自动化脚本、其他服务）有两种方式接入 Conductor：**HTTP API** 和 **CLI**。两种方式能力对等，选哪种取决于调用方的运行环境。

---

## 方式一：HTTP API

适合**服务端程序、后端服务、需要异步回调**的场景。

Conductor 默认监听 `http://localhost:7762`，启动方式：

```bash
conductor daemon start
```

### 典型流程

```
1. 创建任务
   POST /api/tasks
   { "projectId": "proj_xxx", "title": "...", "assignee": "ai", "kind": "once", "executor": {...} }

2. 手动触发（once 任务）
   POST /api/tasks/:id/run

3. 订阅事件流，实时感知状态变化
   GET /api/events?projectId=proj_xxx   （SSE）

4. 查询任务状态
   GET /api/tasks/:id
```

### 完整 API 参考

见 [cli-api.md](cli-api.md)。

---

## 方式二：CLI

适合**本地脚本、AI agent（如 Claude Code）、命令行工具**的场景。CLI 直接操作本地 SQLite，不需要 daemon 在运行。

### 典型流程

```bash
# 1. 创建项目（首次）
conductor project create --name "我的项目" --work-dir "~/projects/xxx" --json

# 2. 注册 AI 任务
conductor task create \
  --title "每日晨报" \
  --project proj_xxx \
  --assignee ai \
  --kind recurring \
  --cron "0 9 * * *" \
  --executor-kind ai_prompt \
  --prompt "今天是 {date}，请生成今日工作摘要" \
  --json

# 3. 手动触发
conductor task run <task-id> --json

# 4. 标记人类任务完成（带回调输出）
conductor task done <task-id> --output "已确认，结果是 xxx" --json

# 5. 查看执行日志
conductor task logs <task-id> --json
```

### AI Agent 使用建议

- 所有命令加 `--json`，解析结构化输出
- 创建人类等待任务时，在 `--instructions` 里写清楚人类需要执行的命令（含 task id）
- `task done` 的 `--output` 会注入到被阻塞 AI 任务的 `{completionOutput}` 占位符

---

## 两种方式的区别

| | HTTP API | CLI |
|---|---|---|
| 需要 daemon 运行 | 是 | 否 |
| 适合场景 | 服务端、远程调用 | 本地脚本、AI agent |
| 实时事件 | SSE（/api/events） | 轮询 task get |
| 流式输出 | runs/spool 端点 | 不支持 |
