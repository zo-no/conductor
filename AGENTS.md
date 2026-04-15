# AGENTS.md — Conductor 项目上下文

> 这是 AI 协作说明文件。开始任何工作前先读完这个文件。

---

## 这个项目是什么

Conductor 是一个**本地优先的任务调度引擎**，给人类和 AI 一起使用的 todolist + agent 调度器。核心对象是 **Project**（任务容器）和 **Task**（独立可执行单元，human 或 ai 执行，支持一次性/定时/周期触发）。

详见 [docs/](docs/)：架构 → `architecture.md`，执行模型 → `execution-model.md`，CLI/API → `cli-api.md`，外部接入 → `integration.md`。

---

## AI Agent 使用 Conductor CLI

**不要凭记忆猜命令。** 每次需要操作 Conductor 时，先运行：

```bash
conductor help-ai
```

输出是一个 JSON 速查表，按**意图**列出对应命令（例如 `"create ai task (recurring)"` → 完整命令）。找到你需要的那一条，复制使用。不认识的参数再用 `conductor <command> --help` 查详细说明。

**不需要一次读完所有文档**，`help-ai` 覆盖 90% 的场景。只有遇到复杂流程（如 human 卡点、任务依赖链）时才参考 `docs/integration.md`。

---

## 开发规范

1. **Model 层无 HTTP 依赖**：model 函数只接受普通参数
2. **CLI 和 HTTP 共用 Model**：不在 controller 里写业务逻辑
3. **类型从 `@conductor/types` 引入**
4. **所有 CLI 命令支持 `--json`**：AI 调用时解析 JSON 输出
5. **SQLite 用 Bun 内置**
6. **任务操作写 task_ops**：每次状态变更都要记录操作日志
