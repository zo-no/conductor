# CLI & HTTP API

> 所有 CLI 命令支持 `--json` 输出，AI 调用时解析 JSON。

---

## CLI 命令

### 任务操作

```bash
# 查询
conductor task list [--project <id>] [--kind once|scheduled|recurring] \
  [--assignee ai|human] [--status <status>] [--json]
conductor task get <id> [--json]
conductor task logs <id> [--limit 20] [--json]
conductor task ops <id> [--limit 20] [--json]

# 创建（AI 任务）
conductor task create \
  --title "每日晨报" \
  --project <id> \
  --assignee ai \
  --kind once|scheduled|recurring \
  [--executor-kind ai_prompt|script|http] \
  [--prompt "..."] \
  [--script "python3 ~/scripts/daily.py"] \
  [--work-dir "~/projects/xxx"] \
  [--http-url "https://..."] \
  [--http-method GET|POST|PUT|DELETE] \
  [--http-body "..."] \
  [--cron "0 9 * * *"] \
  [--scheduled-at "2026-04-20T09:00"] \
  [--include-last-output] \
  [--custom-var key=value] \
  [--review-on-complete] \
  [--depends-on <task-id>] \
  [--json]

# 创建（人类任务）
conductor task create \
  --title "需要确认预算" \
  --project <id> \
  --assignee human \
  --kind once \
  [--instructions "请确认后运行：conductor task done <id> --output '结果'"] \
  [--source-task <blocked-ai-task-id>] \
  [--json]

# 状态变更
conductor task done <id> [--output "完成说明"] [--json]
conductor task cancel <id> [--json]
conductor task run <id> [--json]

# 修改
conductor task update <id> \
  [--title "..."] \
  [--description "..."] \
  [--cron "..."] \
  [--scheduled-at "..."] \
  [--prompt "..."] \
  [--enable] \
  [--disable] \
  [--json]

# 删除
conductor task delete <id> [--json]
```

---

### 项目操作

```bash
conductor project list [--json]
conductor project get <id> [--json]
conductor project create --name "新项目" [--goal "目标描述"] [--work-dir "~/projects/xxx"] [--json]
conductor project update <id> [--name "..."] [--goal "..."] [--work-dir "..."] [--json]
conductor project delete <id> [--json]
conductor project archive <id> [--json]
conductor project unarchive <id> [--json]
```

---

### 提示词操作

```bash
conductor prompt get [--project <id>] [--json]
conductor prompt set "<content>" [--project <id>]
conductor prompt delete [--project <id>]
```

---

### 系统操作

```bash
conductor daemon start    # 启动后台调度器
conductor daemon stop
conductor daemon status
conductor version
conductor info [--json]
```

---

## HTTP API

默认端口：`7762`

### Projects

```
GET    /api/projects          列出所有项目
POST   /api/projects          创建项目
GET    /api/projects/:id      获取项目
PATCH  /api/projects/:id      更新项目
DELETE /api/projects/:id      删除项目
```

### Tasks

```
GET    /api/tasks             列出任务（?projectId= &kind= &status= &assignee=）
POST   /api/tasks             创建任务
GET    /api/tasks/:id         获取任务
PATCH  /api/tasks/:id         更新任务
DELETE /api/tasks/:id         删除任务
POST   /api/tasks/:id/run     手动触发
POST   /api/tasks/:id/done    标记完成（人类任务）
POST   /api/tasks/:id/cancel  取消
GET    /api/tasks/:id/logs    执行日志
GET    /api/tasks/:id/ops     操作日志
```

### Prompts

```
GET    /api/prompts/system          获取系统级 prompt
PATCH  /api/prompts/system          更新系统级 prompt
GET    /api/prompts/project/:id     获取项目级 prompt
PATCH  /api/prompts/project/:id     更新项目级 prompt
DELETE /api/prompts/project/:id     删除项目级 prompt
```
