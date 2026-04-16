# PLAN: AI 大脑任务 — 项目自主迭代

> 状态: DONE
> 创建时间: 2026-04-16
> 关联需求: 每个项目有一个 AI 大脑任务，自主规划并推进项目目标

---

## 需求描述

每个项目可以启动一个"大脑任务"：一个周期运行的 AI 任务，自主读取项目状态、规划下一步、创建子任务（给 AI 或给人），以目标完成为驱动，人类只在卡点介入。

核心模式：
- AI 是主导者，人类是顾问
- AI 自主决定创建什么任务、给谁
- 遇到高风险操作或需要决策时，创建 human todo 问人
- 30 分钟一次周期，持续推进

---

## 方案设计

### 1. 新增 executor 变量

在 `buildVars()` 里加三个变量：

| 变量 | 值 |
|------|-----|
| `{projectId}` | `task.projectId` |
| `{projectGoal}` | `project?.goal ?? ''` |
| `{workDir}` | `project?.workDir ?? ''` |

### 2. 提示词文件

在 `packages/core/src/prompts/` 目录下创建：

- `brain-task.md` — 大脑任务（规划者）prompt
- `README.md` — 说明文件，解释变量和用法

### 3. 大脑任务 prompt 设计

```
你是项目 "{projectName}" 的 AI 项目经理，工作区在 {workDir}。

项目目标：
{projectGoal}

## 每次运行步骤

### 1. 读取现状
先运行：
- conductor help-ai
- conductor project get {projectId} --json
- conductor task list --project {projectId} --json

再读取工作区关键文件了解背景。

### 2. 分析
- 目标推进到哪了？
- 有没有 running/pending 的任务？有的话不创建新任务，等完成
- 上次任务输出了什么？有遗留问题吗？
- 工作区文件有没有需要关注的内容？

### 3. 决策（0-3 个任务）
有 pending/running 任务时不创建新任务。

给 AI 执行：
conductor task add {projectId} "标题" --assignee ai --prompt "背景、目标、完成标准、输出格式" --run

给人决策：
conductor task add {projectId} "标题" --assignee human --waiting-instructions "需要做什么、为什么需要人、提供什么信息"

无事可做时：输出"暂无新任务"，结束。

## 文件操作规则
- 可以读取工作区任何文件
- 低风险操作（更新状态、补充记录、格式整理）可以直接执行
- 高风险操作（删除内容、修改目标/计划、结构性改动）必须创建 human todo 确认
- 保持文件整洁，方便人类阅读

## 安全规则
- 不能静默修改文件（高风险操作必须先问人）
- 不能执行破坏性操作
- 有疑问时创建 human todo 问人，不自己猜

## 输出格式
每次运行结束输出：
- 分析了什么
- 创建了哪些任务（或为什么没创建）
```

---

## 涉及文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/core/src/services/executor.ts` | 修改 | buildVars() 加 projectId、projectGoal、workDir |
| `packages/core/src/prompts/brain-task.md` | 新建 | 大脑任务 prompt |
| `packages/core/src/prompts/README.md` | 新建 | 提示词目录说明 |

---

## 验收标准

- [ ] `{projectId}`、`{projectGoal}`、`{workDir}` 在 ai_prompt 任务里正确注入
- [ ] `packages/core/src/prompts/brain-task.md` 内容完整可直接复制使用
- [ ] 用理财项目创建一个大脑任务，能正常运行并读取项目状态
