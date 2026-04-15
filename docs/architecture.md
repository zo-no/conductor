# Conductor 架构概览

## 它是什么

Conductor 是一个**本地优先的 todo list、任务系统、任务调度系统**。

它允许**人类和 AI 一起编写任务**，并把任务**派给人类或 AI** 去执行。

它关心的核心不是对话本身，而是任务的创建、指派、调度、执行、跟踪和恢复。

这件事的本质目的有三层：
- 把**人类任务和 AI 任务集中记录在同一个地方**
- 让任务执行完成后留下**可追踪的日志和操作历史**
- 让一个 Project 内的任务集合逐步沉淀成可迭代的**工作流**

也就是说，Conductor 不只是“把任务跑掉”，而是要把任务的执行历史保留下来，让用户可以基于每天的执行结果持续优化任务流。

核心原则：
- **Project** 是任务的上下文边界，不是复杂的组织树
- **Task** 是唯一的执行单元，人类和 AI 共用同一个 todo list
- **assignee** 决定任务派给谁执行：`human` 或 `ai`
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
- **人类**：主要通过 Web UI 管理和处理任务
- **Agent**：主要通过 CLI 读写任务、推进任务执行
- **外部系统 / 集成方**：主要通过 HTTP API 调用

这些入口操作的是同一个任务系统，只是交互方式不同。

写操作约束：
- 任务系统中的核心写操作应同时提供 **CLI** 和 **HTTP API** 两个版本
- **CLI** 主要服务 agent 调用和自动化执行
- **HTTP API** 主要服务 Web UI 和外部系统集成

---

## 核心对象

### Project

Project 是任务的**上下文边界**，不是系统真正的执行主体。

它的作用是把一组相关任务放在一起，并提供共享上下文。

Project 负责回答：
- 这些任务属于哪个目标
- 这些任务默认在哪个工作目录执行
- 这个项目当前是否处于活跃状态

Project 更像任务空间，而不是复杂的层级管理对象。

当前版本里：
- 一个 Project 可以承载多组任务流
- 这些任务流共享同一个 Project 上下文
- 但 `workflow` 还不是系统中的显式对象

也就是说，当前系统显式建模的是 Project、Task、TaskLog、TaskOp；
workflow 目前仍是用户在任务集合及其历史之上观察到的结构，而不是单独的数据模型。

系统约束：
- 每个 Task 都必须归属一个 Project
- 系统内置默认 Project：`日常事务`
- 如果创建任务时没有显式指定 Project，系统应将其归入 `日常事务`
- `日常事务` 是不可变的默认 Project，不能删除、不能改名、不能归档

### Task

Task 是系统最核心的对象，也是系统唯一的执行单元。

无论一个任务是谁写的、谁来执行、怎么触发，最终都应该落成一个 Task。

也就是说：
- 人类写给自己的待办，是 Task
- AI 写给自己的执行任务，是 Task
- 人类派给 AI 的任务，是 Task
- AI 派给人类确认或补充信息的任务，也是 Task

每个 Task 必须属于且只属于一个 Project，不允许存在悬空任务。

Task 由两个维度定义：
- `assignee`
  谁执行：`human` 或 `ai`
- `kind`
  怎么触发：`once`、`scheduled`、`recurring`

这两个维度正交，意味着：
- 人类任务不只是普通 todo，也可以是定时提醒或周期性任务
- AI 任务不只是手动触发，也可以被定时或周期调度

从系统视角看，Task 需要同时承载四类信息：
- **内容**：任务是什么
- **指派**：任务派给谁
- **触发**：任务什么时候执行
- **状态**：任务当前推进到哪里

这四类信息构成 Task 的最小核心：
- **内容**：至少要能表达任务标题和必要描述
- **指派**：至少要能表达任务当前派给 `human` 还是 `ai`
- **触发**：至少要能表达这是一次性任务、定时任务还是周期任务
- **状态**：至少要能表达任务是否待执行、执行中、已完成、失败、取消或阻塞

在这个最小核心之外，其他能力都应视为扩展，而不是 Task 的定义本身。

例如，这些更适合被看作扩展能力：
- 执行器细节（script / ai_prompt / http）
- 前后依赖关系
- 人类确认 / 阻塞恢复
- review 任务
- 更复杂的 workflow 结构

也就是说，Task 首先是“任务系统里的统一记录单元”，然后才是在某些场景下承载自动化和调度能力的对象。

### TaskLog

TaskLog 记录一次执行尝试的结果。

它回答：
- 这次有没有真的执行
- 成功还是失败
- 输出和报错是什么

TaskLog 不只是调试信息，也是后续迭代任务流的依据。

它更偏向回答一次“运行”发生了什么。

因此：
- 对 AI 任务来说，TaskLog 是执行历史
- 对人类任务来说，TaskLog 也可以逐步承接完成结果和补充说明
- 它不应该被看成可有可无的临时日志
- 它是系统沉淀经验和复盘任务流的重要基础

### TaskOp

TaskOp 记录任务状态变化和关键操作。

它回答：
- 这个任务为什么变成现在这样
- 是谁触发了这次变化
- 关键动作发生在什么时候

它更偏向回答一次“状态变化”是怎么发生的。

因此：
- TaskLog 关注运行结果
- TaskOp 关注状态流转和关键动作
- 两者组合起来，才构成一个任务完整的历史

从产品角度看，TaskLog 和 TaskOp 都是一等公民：
- 没有它们，系统只能记录“现在是什么”
- 有了它们，系统才能回答“为什么会变成现在这样”
- 也只有这样，用户才可能基于历史持续优化任务流

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

它们最终服务的不是一次性执行，而是**围绕 Project 持续沉淀和迭代任务工作流**。

---

## To Do

- 将 `workflow` 设计为系统中的显式对象，而不只是概念层结构
- 支持在一个 Project 中区分多条独立工作流
- 支持从任务日志和操作历史中回看、分析和迭代工作流
- 支持让用户在日常使用中逐步沉淀出更稳定的任务流

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
