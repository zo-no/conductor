# PLAN: 流水线中的人机协作闭环

> 状态: DRAFT（讨论中）
> 创建时间: 2026-04-16
> 关联需求: 让用户不再思考"我该做什么"，而是推进一个个目标

---

## 核心问题

**现状**：用户需要主动回到 Claude 会话，查看 AI 停在哪里，然后提供信息/决策。

**目标**：AI 停下来时，用户收到一个清晰的 todo，知道自己要做什么，做完后流水线自动继续。

---

## Case 分析

### Case 1：AI 需要用户提供信息

**场景**：AI 在执行"生成周报"任务时，需要知道本周的重点项目是什么。

**现在的体验**：
- AI 在 Claude 会话里问了一个问题然后停下来
- 用户不知道 AI 停了，或者不记得去回复

**理想体验**：
1. AI 在 conductor 里创建一个 human todo："请告诉我本周的重点项目"
2. 用户手机/桌面收到通知
3. 用户打开 conductor，看到 todo，填写答案
4. conductor 把答案传给 AI，AI 继续执行

**自动化的卡点**：
- 用户填写的"答案"怎么传回给 AI？
  - 方案A：用户填完 todo，conductor 启动新的 Claude 会话，把答案注入 context
  - 方案B：AI 会话一直挂着（长 session），用户 complete todo 时 unblock
  - 方案C：AI 把"等待答案"写入任务状态，下次 AI 任务读取

---

### Case 2：AI 需要用户做决策

**场景**：AI 分析了代码库，发现有两种重构方案，需要用户选择。

**理想体验**：
1. AI 创建 human todo："请选择重构方案"，附带两个选项的描述
2. 用户看到 todo，选择方案 A 或 B
3. AI 自动拿到选择结果，继续执行对应方案

**自动化的卡点**：
- conductor todo 目前是文本输入，没有"选项选择"交互
- 用户选完后怎么触发下一个 AI 任务？（`--review-on-complete` 可以做到）

---

### Case 3：AI 完成一个阶段，需要用户确认后才继续

**场景**：AI 写完了一个功能的代码，需要用户 review 后才能 commit。

**理想体验**：
1. AI 创建 human todo："请 review 以下代码变更"，附带 diff 链接或内容
2. 用户 review，approve 或提出修改意见
3. 如果 approve → AI 继续 commit
4. 如果有修改意见 → AI 拿到意见，重新修改

**自动化的卡点**：
- 用户的"修改意见"是非结构化文本，AI 需要能读到它
- approve vs reject 的分支逻辑怎么表达？

---

### Case 4：AI 任务链中的检查点

**场景**：一个长任务链（分析 → 写代码 → 测试 → 部署），用户想在"部署"前手动确认。

**理想体验**：
1. 任务链定义时，在"部署"前插入一个 human 检查点
2. 前面的任务自动执行
3. 到检查点时，通知用户，等待确认
4. 用户确认后，部署任务自动触发

**自动化的卡点**：
- 任务链的定义方式（目前 conductor 有任务依赖吗？）
- 检查点的状态怎么持久化？

---

## 现有能力盘点

| 能力 | 现状 |
|------|------|
| AI 创建 human todo | ✅ `conductor task create --assignee human` |
| human 完成后触发下一 AI 任务 | ✅ `--review-on-complete` |
| 语音通知 AI 任务完成 | ✅ TTS 已实现 |
| 通知用户有新 todo | ❓ 只有 TTS，没有推送/桌面通知 |
| 用户填写 todo 结果传回 AI | ❓ 不清楚机制 |
| todo 支持结构化选项 | ❌ 目前只有文本 |
| 任务链中插入 human 检查点 | ❌ 需要设计 |
| AI 读取上一个 human todo 的结果 | ❓ 需要验证 |

---

## 需要讨论的问题

### Q1：用户填写 todo 结果，怎么传回给 AI？

`--review-on-complete` 触发下一个 AI 任务时，AI 能拿到什么 context？
- 只是知道"上一个任务完成了"？
- 还是能拿到用户填写的内容？

### Q2：通知机制

用户怎么知道有新的 human todo？
- 目前：TTS 播报（只有 AI 任务完成时）
- 缺失：human todo 创建时的通知

是否需要：桌面通知、手机推送、或者只是 TTS？

### Q3：todo 的"答案"格式

用户完成 todo 时，输入的内容是什么形式？
- 自由文本
- 结构化选项（A/B/C）
- 文件上传？

### Q4：跑通第一个 end-to-end case

哪个 case 最简单、最能验证整个闭环？

建议：**Case 3（代码 review 后继续）**，因为：
- 流程最清晰（写代码 → review → commit）
- AI 不需要等待用户输入特定内容，只需要 approve/reject
- `--review-on-complete` 已经能触发下一步

---

## 下一步

1. 先把 Q1 搞清楚：`--review-on-complete` 触发的 AI 任务，能拿到 human todo 的 instructions/result 吗？
2. 设计最小可行的 end-to-end case
3. 跑通，找出卡点，再迭代
