# AGENTS.md — Conductor 项目上下文

> 这是 AI 协作说明文件。开始任何工作前先读完这个文件。

---

## 这个项目是什么

Conductor 是一个**本地优先的任务调度引擎**，给人类和 AI 一起使用的 todolist + agent 调度器。

核心对象：
- **Project**（项目）— 有目标的任务容器，任务归属于项目
- **Task**（任务）— 独立可执行单元，human 或 ai 执行，支持一次性/定时/周期触发

AI 通过 CLI 操作任务，人类通过 CLI 或 HTTP API 管理。

---

## 目录结构

```
conductor/
├── packages/
│   ├── core/                # 后端（Bun + Hono + TypeScript）
│   │   └── src/
│   │       ├── db/          # SQLite 初始化（建表）
│   │       ├── models/      # 纯数据操作层（无副作用，无 HTTP 依赖）
│   │       ├── services/    # 有状态服务层（调度器）
│   │       │   └── scheduler.ts
│   │       ├── controllers/
│   │       │   ├── http/    # Hono 路由层
│   │       │   └── cli/     # Commander CLI 层
│   │       ├── server.ts    # HTTP server 入口（port 7762）
│   │       └── cli.ts       # CLI 入口（bin: conductor）
│   │
│   └── types/               # 共享类型
│       └── src/index.ts
│
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── execution-model.md
│   ├── database-schema.md
│   ├── cli-api.md
│   ├── ui-design.md
│   └── decisions.md
├── AGENTS.md
└── pnpm-workspace.yaml
```

---

## MVC 架构

```
Model（packages/core/src/models/）
  不依赖 HTTP，直接操作 SQLite
  CLI 和 HTTP routes 都调用这层

Controller — HTTP（packages/core/src/controllers/http/）
  Hono 路由，只做：解析请求 → 调用 Model → 返回响应

Controller — CLI（packages/core/src/controllers/cli/）
  Commander 命令，直接调用 Model，不走 HTTP
```

---

## 开发规范

1. **Model 层无 HTTP 依赖**：model 函数只接受普通参数
2. **CLI 和 HTTP 共用 Model**：不在 controller 里写业务逻辑
3. **类型从 @conductor/types 引入**
4. **所有 CLI 命令支持 --json**：AI 调用时解析 JSON 输出
5. **SQLite 用 Bun 内置**
6. **任务操作写 task_ops**：每次状态变更都要记录操作日志

---

## 与 MelodySync 的关系

两个独立产品，各自完整，通过 CLI 互调：

- **MelodySync**：AI 对话工具，用户在这里和 AI 聊天、拆解目标
- **conductor**：任务调度引擎，自动执行已经想清楚的事

典型路径：
1. 用户在 MelodySync 会话里和 AI 讨论一个目标
2. AI 调用 `conductor` CLI 把拆出的任务注册成流水线
3. conductor 按计划自动执行，用户在 conductor UI 里查看和干预
4. 遇到卡点，conductor 创建人类等待任务，用户在 conductor UI 完成后继续

随着使用积累，越来越多的事情沉淀到 conductor 自动执行，逐步解放用户。
