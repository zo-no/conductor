# Conductor Prompts

内置提示词模板，供 AI 任务直接使用。

## 可用变量

所有 ai_prompt 任务都支持以下变量注入：

| 变量 | 说明 |
|------|------|
| `{date}` | 今天日期，如 `2026-04-16` |
| `{datetime}` | 当前时间（ISO 格式） |
| `{taskTitle}` | 任务标题 |
| `{taskDescription}` | 任务描述 |
| `{projectId}` | 项目 ID |
| `{projectName}` | 项目名称 |
| `{projectGoal}` | 项目目标 |
| `{workDir}` | 项目工作区目录 |
| `{completionOutput}` | 上一个任务的输出（同 lastOutput） |
| `{lastOutput}` | 同 completionOutput |

自定义变量通过任务的 `executorOptions.customVars` 注入。

## 模板列表

| 文件 | 用途 |
|------|------|
| `brain-task.md` | AI 大脑任务：周期运行，自主规划项目下一步 |
