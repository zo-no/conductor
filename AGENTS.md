# AGENTS.md — Conductor 项目上下文

> 这是 AI 协作说明文件。开始任何工作前先读完这个文件。

---

## 这个项目是什么

Conductor 是一个**本地优先的任务调度引擎**，给人类和 AI 一起使用的 todolist + agent 调度器。核心对象是 **Project**（任务容器）和 **Task**（独立可执行单元，human 或 ai 执行，支持一次性/定时/周期触发）。

架构、数据模型、执行逻辑、CLI/API、UI 设计详见 [docs/](docs/)。

---

## 开发规范

1. **Model 层无 HTTP 依赖**：model 函数只接受普通参数
2. **CLI 和 HTTP 共用 Model**：不在 controller 里写业务逻辑
3. **类型从 `@conductor/types` 引入**
4. **所有 CLI 命令支持 `--json`**：AI 调用时解析 JSON 输出
5. **SQLite 用 Bun 内置**
6. **任务操作写 task_ops**：每次状态变更都要记录操作日志
