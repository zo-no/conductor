# Conductor

任何 AI agent 都能用的本地任务调度系统。

把一个长期目标（理财计划、产品开发、团队流程）交给你的 agent，它会把目标拆解成可执行的任务，注册定时调度，自动运行，并留下完整的执行记录。

Conductor 不绑定任何特定的 AI 产品。只要 agent 能运行终端命令，就能用 Conductor 管理任务——无论是 Claude Code、Codex CLI、Cursor、Copilot，还是你自己写的 agent。

---

## 快速安装

把下面这段话复制给你的 agent，让它帮你完成安装：

```
请帮我安装 Conductor。步骤如下：

1. 确认已安装 bun（https://bun.sh）和 pnpm，如果没有先安装
2. clone 仓库：git clone https://github.com/your-org/conductor ~/conductor
3. 进入目录：cd ~/conductor
4. 安装依赖：pnpm install
5. 构建 CLI：bun build packages/core/cli.ts --compile --outfile conductor
6. 安装到 PATH：cp conductor ~/.bun/bin/conductor
7. 验证安装：conductor version
8. 安装 skills（可选，支持 Claude Code 和 Codex CLI）：bash skills/install.sh
9. 启动后台服务：conductor daemon start
10. 确认服务正常：conductor daemon status

完成后告诉我 conductor version 的输出，以及 daemon 是否在运行。
```

---

## 手动安装

**前置要求：** [bun](https://bun.sh) + [pnpm](https://pnpm.io)

```bash
# 克隆仓库
git clone https://github.com/your-org/conductor ~/conductor
cd ~/conductor

# 安装依赖
pnpm install

# 构建并安装 CLI
bun build packages/core/cli.ts --compile --outfile conductor
cp conductor ~/.bun/bin/conductor

# 验证
conductor version

# 安装 skills（可选）
# 自动检测 Claude Code（~/.claude）和 Codex CLI（~/.codex）并安装
bash skills/install.sh
```

---

## 启动

```bash
# 启动后台调度器（负责定时任务的自动触发）
conductor daemon start

# 启动 Web UI
pnpm --filter @conductor/web dev
# 打开 http://localhost:5173
```

## Web UI

打开 `http://localhost:5173`，你会看到一个三栏布局：左侧项目列表、中间任务时间线、右侧任务编辑面板。

时间线按时间分区展示所有任务——今天要做的、未来的定时任务、周期任务、以及等待你确认的 AI 卡点任务。

**主要功能：**
- 查看 AI 任务的实时执行输出（流式显示）
- 编辑任务的 prompt、调度时间、执行方式
- 勾选完成人类任务，触发等待中的 AI 任务继续执行
- 查看每个任务的执行历史和操作日志
- 管理系统级 prompt（影响所有 AI 任务的上下文）

移动端适配：顶部 tab 切换项目，人类任务和 AI 任务分开显示。

---

## 用 Agent 规划你的第一个项目

如果你用的是 Claude Code 或 Codex CLI，安装 skills 后可以直接运行：

```
/plan-project
```

通过对话描述你的目标（理财计划、产品开发、学习计划……），agent 会把目标拆解成 Conductor 任务，设置好定时调度，写入系统。

其他 agent 可以直接通过 CLI 操作，详见 [Agent 接入指南](docs/integration.md)。

---

## 核心概念

**Project** — 任务的上下文边界，一个目标对应一个项目

**Task** — 唯一的执行单元，两个维度：
- `assignee`：`human`（你来做）或 `ai`（自动执行）
- `kind`：`once`（一次性）、`scheduled`（定时一次）、`recurring`（周期重复）

**Executor** — AI 任务的执行方式：
- `ai_prompt`：调用 Claude / Codex 执行指令
- `script`：运行 shell 命令
- `http`：调用 HTTP 接口

---

## CLI 速查

```bash
# 项目
conductor project list
conductor project create --name "理财计划" --goal "3个月存款增加20%"

# 任务
conductor task list --project <proj-id>
conductor task create --title "每周收支复盘" --project <proj-id> \
  --assignee ai --kind recurring --cron "0 21 * * 0" \
  --executor-kind ai_prompt --prompt "今天是 {date}，请分析本周收支情况"

# 执行
conductor task run <task-id>
conductor task done <task-id> --output "已确认"

# 服务
conductor daemon start
conductor daemon status
conductor daemon stop
```

---

## 数据存储

所有数据保存在本地 `~/.conductor/db.sqlite`，不依赖任何云服务。

---

## 文档

- [架构概览](docs/architecture.md)
- [执行模型](docs/execution-model.md)
- [CLI & HTTP API 参考](docs/cli-api.md)
- [Agent 接入指南](docs/integration.md)
- [Web UI 设计](docs/ui-design.md)
