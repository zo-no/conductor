# Conductor 架构概览

## 它是什么

Conductor 是一个**本地优先的任务调度引擎**。

它解决的问题不是“聊天”，也不是“通用 agent 平台编排”，而是把已经想清楚的事情沉淀成可追踪、可调度、可恢复的任务系统。

核心原则：
- **Project** 是任务的上下文边界，不是复杂的组织树
- **Task** 是唯一的执行单元，人类任务和 AI 任务共用同一套任务系统
- **本地 SQLite** 是系统事实来源
- **调度、执行、审计** 是核心能力，界面和接入方式是外围能力

---

## 系统边界

Conductor 当前由三个部分组成：

- `@conductor/core`
  本地核心服务，负责存储、调度、执行、HTTP API、CLI
- `@conductor/types`
  共享类型定义
- `@conductor/web`
  面向人类用户的 Web UI

面向不同使用者的入口：
- **人类**：主要通过 Web UI，必要时可通过 CLI / HTTP API
- **AI / 外部工具**：主要通过 CLI / HTTP API

与 MelodySync 的关系：
- MelodySync 负责讨论、拆解、决策
- Conductor 负责把任务注册下来并持续执行

---

## 核心对象

### Project

Project 是任务容器，用来承载同一目标下的任务集合与运行上下文。

Project 负责回答：
- 这些任务属于哪个目标
- AI 默认在哪个工作目录执行
- 这个项目是否处于活跃状态

### Task

Task 是系统唯一的执行单元。

Task 由两个维度定义：
- `assignee`
  谁执行：`human` 或 `ai`
- `kind`
  怎么触发：`once`、`scheduled`、`recurring`

这两个维度正交，意味着：
- 人类任务不只是普通 todo，也可以是定时提醒或周期性任务
- AI 任务不只是手动触发，也可以被定时或周期调度

### TaskLog

TaskLog 记录一次执行尝试的结果，回答“这次跑了什么、成功还是失败、输出是什么”。

### TaskOp

TaskOp 记录任务状态变化和关键操作，回答“这个任务为什么变成现在这样、是谁触发的”。

---

## 运行形态

Conductor 当前是**单机、本地进程、单库**架构。

事实来源：
- 本地 SQLite：`~/.conductor/db.sqlite`

核心启动顺序：

```text
initDb
  -> reconcile
  -> startScheduler
  -> startServer
```

这意味着：
- 服务启动时先完成建表和恢复
- 启动后调度器常驻内存
- HTTP API 和调度器运行在同一个本地进程里

这个架构的优点是简单、可控、易本地部署。
代价是：
- 调度器不是分布式的
- 目前没有多实例协调
- SQLite 和进程内状态决定了它更适合作为个人 / 小团队本地工具，而不是远程多租户平台

---

## 分层结构

### 1. 存储层

`packages/core/src/db/`

职责：
- 初始化 SQLite
- 定义表结构
- 提供数据库连接

约束：
- 数据库存储是底层能力，不承载业务规则表达

### 2. Model 层

`packages/core/src/models/`

职责：
- 面向表做纯数据操作
- 不依赖 HTTP
- 不依赖 CLI
- 不持有运行时状态

这层应该是最稳定的一层，主要回答“怎么读写事实”。

### 3. Service 层

`packages/core/src/services/`

职责：
- 调度任务
- 执行 AI / script / http 任务
- 处理恢复、跳过、完成、解除阻塞
- 给 UI 推送事件

这层承载系统行为，是真正的“调度引擎”。

### 4. Interface 层

`packages/core/src/controllers/http/`
`packages/core/src/controllers/cli/`
`packages/web/src/`

职责：
- HTTP：对外暴露 API
- CLI：给 AI 和高级用户一个稳定的命令入口
- Web：给人类用户可视化查看、干预、确认任务状态

接口层只做参数解析、调用底层能力、格式化输出，不应该承载新的业务规则。

---

## 底层架构主线

如果把 Conductor 收成一句话，它的底层主线应该是：

**Task state machine + local scheduler + execution adapters + audit trail**

展开就是四件事：

1. **Task state machine**
   任务状态流转必须清晰，尤其是 `pending / running / done / failed / blocked / cancelled`

2. **Local scheduler**
   本地进程负责 `scheduled` 和 `recurring` 任务的触发与恢复

3. **Execution adapters**
   AI、脚本、HTTP 只是不同执行器，本质上都在消费同一个任务状态机

4. **Audit trail**
   `task_logs` 和 `task_ops` 不是附属品，而是可追踪系统的基础设施

这四件事比“有多少字段”“UI 有多少按钮”更接近 Conductor 的真正内核。

---

## 当前不应在本页展开的内容

以下内容属于其他文档，不应在本页重复展开：

- 详细字段定义
- 占位符和提示词变量列表
- 调度规则细则
- CLI 参数清单
- UI 交互稿

这些内容分别放在：
- [data-model.md](data-model.md)
- [execution-model.md](execution-model.md)
- [cli-api.md](cli-api.md)
- [ui-design.md](ui-design.md)

---

## 文档导航

- 数据结构详情 → [data-model.md](data-model.md)
- 执行模型 → [execution-model.md](execution-model.md)
- 数据库 Schema → [database-schema.md](database-schema.md)
- CLI & API → [cli-api.md](cli-api.md)
- UI 设计 → [ui-design.md](ui-design.md)
- 已决策项 → [decisions.md](decisions.md)
