# PLAN: Showcase 1 — AI 写代码 → 用户 Review → AI Commit

> 状态: DRAFT
> 创建时间: 2026-04-16
> 关联需求: 跑通第一个人机协作闭环 case，输出可复现的 showcase 文档

---

## 需求描述

验证并记录一个完整的人机协作流程：
1. AI 完成代码编写
2. 创建 human todo 等待用户 review
3. 用户 approve 后，AI 自动触发 commit

目标是输出一个 `docs/showcase/01-code-review-loop.md`，让任何人都能按步骤复现这个流程。

---

## 方案设计

### 不写新代码，只验证现有能力

这个 showcase 不需要改 conductor 代码，完全用现有 CLI 手动跑通：

```
步骤 1：手动创建"写代码"AI 任务（模拟，直接跳过，用已有代码文件）
步骤 2：手动创建 human todo，带 --review-on-complete，关联下一个 AI 任务
步骤 3：在 web UI 或 CLI 完成 todo
步骤 4：观察下一个 AI 任务是否自动触发
步骤 5：记录 AI 任务能拿到什么 context
```

### 需要验证的关键问题

1. `--review-on-complete` 触发的 AI 任务，system prompt / instructions 里能拿到 human todo 的内容吗？
2. 用户完成 todo 时有没有地方填"意见"？（web UI 里的完成交互是什么样的？）
3. 如果用户填了意见，AI 任务能读到吗？

### 验证方法

创建一个最小 AI 任务，任务内容就是"把自己收到的 context 打印出来"，这样可以直接看到 AI 拿到了什么。

---

## 涉及文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `docs/showcase/01-code-review-loop.md` | 新建 | showcase 演示文档，验证完成后写 |

不改任何代码。

---

## 验收标准

- [ ] 跑通完整流程：human todo 完成 → AI 任务自动触发
- [ ] 明确 AI 任务能拿到的 context 内容（截图或日志为证）
- [ ] `docs/showcase/01-code-review-loop.md` 写完，包含：背景、前置条件、步骤、截图/输出、发现的卡点

---

## 执行步骤

1. 用 CLI 创建测试用的 AI 任务（内容：打印 context）
2. 创建 human todo，`--review-on-complete` 指向该 AI 任务
3. 在 web UI 完成 todo，观察触发情况
4. 记录结果，写 showcase 文档
