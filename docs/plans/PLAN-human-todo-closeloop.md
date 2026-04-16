# PLAN: Human Todo 交互闭环

> 状态: DONE
> 创建时间: 2026-04-16
> 关联需求: 把基础人机协作 case 跑通

---

## 需求描述

让 human todo 真正闭环：
1. human todo 创建时，TTS 通知用户（不只是 AI 任务完成时才通知）
2. web UI 完成 todo 时，支持填写意见/输出，传给下一个 AI 任务

---

## 方案设计

### 改动 1：human todo 创建时 TTS 通知

在 `scheduler.ts` 的 `reviewOnComplete` 逻辑里，创建 human todo 后调用 `speak()`。

```typescript
// 创建 human todo 后
speak(`${fresh.title} 已完成，请查看待办任务`).catch(() => {})
```

### 改动 2：web UI done 支持填意见

`handleDone` 改为弹出一个简单的 inline 输入框（不用 modal），用户可以填意见也可以直接跳过。

交互：
- 点"完成"按钮 → 按钮变成一个小输入框 + 确认按钮
- 输入框 placeholder："填写意见（可选）"
- 点确认 → 调 `api.tasks.done(task.id, { output: text })`
- 按 Enter 也可以提交
- 不填直接确认也可以（output 为空）

---

## 涉及文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/core/src/services/scheduler.ts` | 修改 | reviewOnComplete 后加 TTS 通知 |
| `packages/web/src/components/tasks/TaskDetail.tsx` | 修改 | done 按钮改为支持填意见 |

---

## 验收标准

- [ ] AI 任务完成触发 reviewOnComplete 时，TTS 播报提醒
- [ ] web UI human todo 点完成，出现意见输入框
- [ ] 填写意见后提交，下一个 AI 任务的 `{completionOutput}` 能拿到内容
- [ ] 不填意见直接提交也能正常触发下一步
