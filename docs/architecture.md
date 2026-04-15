# Conductor 架构概览

## 产品定位

Conductor 是一个**本地优先的任务调度引擎**，给人类和 AI 一起使用的 todolist + agent 调度器。

核心理念：
- **Project** 是有目标的任务容器，任务归属于项目
- **Task** 是独立的可执行单元，`assignee` 决定谁执行，`kind` 决定怎么触发
- **人类任务**是普通 todo，**AI 任务**是自动执行的任务，两者共存在同一个列表里
- **AI 通过 CLI 操作任务**，人类通过 CLI 或 HTTP API 管理

## 顶层数据模型

```
Project
  ├── id, name
  ├── goal?          （可选目标描述）
  ├── workDir?       （AI 执行时的工作目录）
  ├── systemPrompt?  （项目级 prompt）
  └── Tasks[]
        ├── assignee: human | ai
        ├── kind: once | scheduled | recurring
        ├── order?         （展示顺序）
        ├── dependsOn?     （前置任务 id）
        ├── executor?      （ai: script | http | ai_prompt）
        ├── executorOptions（includeLastOutput, customVars, reviewOnComplete）
        ├── TaskLog[]
        └── TaskOps[]
```

## 上下文注入

AI 执行任务时，自动注入以下占位符：

| 占位符 | 内容 | 注入条件 |
|---|---|---|
| `{date}` | 当前日期 YYYY-MM-DD | 始终注入 |
| `{datetime}` | 当前时间 ISO 8601 含时区 | 始终注入 |
| `{taskTitle}` | 当前任务标题 | 始终注入 |
| `{taskDescription}` | 当前任务描述 | 有值时注入 |
| `{projectName}` | 项目名称 | 始终注入 |
| `{lastOutput}` | 上次执行结果 | `includeLastOutput=true` 且有记录时 |
| 自定义 `{key}` | 用户自定义值 | `customVars` 里有定义时 |

提示词组装顺序：
```
[系统级 prompt]
[项目级 systemPrompt]（有值时追加）
[任务级 prompt]
```

占位符在整个组装完的字符串上统一做 replaceAll。

## 文档导航

- 数据结构详情 → [data-model.md](data-model.md)
- 执行模型 → [execution-model.md](execution-model.md)
- 数据库 Schema → [database-schema.md](database-schema.md)
- CLI & API → [cli-api.md](cli-api.md)
- 已决策项 → [decisions.md](decisions.md)
