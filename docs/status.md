# 实现状态

> 对照设计文档和代码，记录每个功能点的实现状态。
> ✅ 已实现 | 🟡 部分实现 | ❌ 未实现

---

## 数据模型

| 特性 | 状态 | 备注 |
|------|------|------|
| Project 基本字段（id/name/goal/workDir/archived） | ✅ | |
| Task assignee × kind 正交 | ✅ | |
| Task 完整状态机 | ✅ | |
| TaskRun + TaskRunSpool | ✅ | |
| TaskLog 保留最近 50 条（清理） | 🟡 | 有 limit 查询，无定期清理 |
| TaskLog output 截断至 64KB | ❌ | executor 输出未做截断 |
| TaskOp 永久保留 | ✅ | |
| tasks.last_session_id 字段 | ✅ | |
| task_runs.session_id 字段 | ✅ | |

---

## CLI

| 命令 | 状态 |
|------|------|
| `task list/get/logs/ops` | ✅ |
| `task create`（AI + human 完整参数） | ✅ |
| `task update/delete/run/done/cancel` | ✅ |
| `project list/get/create/update/delete/archive/unarchive` | ✅ |
| `prompt get/set/delete` | ✅ |
| `daemon start` | ✅ |
| `daemon status` | ✅ |
| `daemon stop` | ✅ |
| `info [--json]` | ✅ |
| `version` | ✅ |

---

## HTTP API

| 端点 | 状态 |
|------|------|
| Projects CRUD + archive/unarchive | ✅ |
| Tasks CRUD + run/done/cancel/logs/ops | ✅ |
| Tasks runs + spool | ✅ |
| Prompts system + project | ✅ |
| Events SSE（含 run_line） | ✅ |

---

## 执行模型

| 特性 | 状态 | 备注 |
|------|------|------|
| 提示词三层组装（system → project → task） | ✅ | |
| 占位符注入（date/datetime/taskTitle/taskDescription/projectName） | ✅ | |
| customVars 自定义占位符 | ✅ | |
| continueSession（resume 上次对话） | ✅ | |
| claude --resume 接续对话 | ✅ | |
| codex exec resume 接续对话 | ✅ | |
| script executor（含超时/SIGTERM/SIGKILL） | ✅ | |
| ai_prompt executor（claude CLI） | ✅ | |
| http executor | ✅ | |
| reviewOnComplete | ✅ | |
| dependsOn 跳过逻辑 | ✅ | |
| 调度器（scheduled/recurring/reconcile） | ✅ | |
| human-in-the-loop unblock + 自动重触发 | ✅ | |

---

## Web UI

| 特性 | 状态 | 备注 |
|------|------|------|
| PC 三栏布局 | ✅ | |
| 移动端项目 tab + human/AI tab | ✅ | |
| 时间线分区（今天/未来/周期/无时间/已完成） | ✅ | |
| blocked 任务内联显示关联 human 任务 | ✅ | |
| 任务编辑面板（ai_prompt/script/http/schedule） | ✅ | |
| continueSession / reviewOnComplete toggle | ✅ | |
| agent 选择（claude/codex） | ✅ | |
| http executor Headers 配置 | ✅ | |
| 系统级 prompt 管理入口 | ✅ | Sidebar 底部按钮 |
| dependsOn 展示和设置 | ✅ | TaskDetail 展示，TaskForm 选择器 |
| enabled=false 暂停标签 | ✅ | TaskRow 已有 |
| 项目新建改用正式对话框 | ✅ | PromptDialog |
| 默认项目"日常事务"自动创建 | ✅ | initDb seed |
| 默认项目不可删除/改名/归档 | ✅ | HTTP controller 保护 |
| human 任务完成后动画过渡 | ❌ | 纯视觉细节 |
