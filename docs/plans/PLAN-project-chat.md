# PLAN: 项目会话功能

> 状态: APPROVED
> 创建时间: 2026-04-16
> 关联需求: 每个项目有一个持续对话，可以用自然语言操作任务

---

## 需求描述

每个 Project 配一个 AI 助理对话。用户通过自然语言和 AI 聊，AI 知道当前项目的任务，可以调用 Conductor CLI 帮用户创建任务、查状态、触发执行、规划工作流。

对话是持续累积的（不分会话），每个项目一个 thread。

---

## 方案设计

### 数据层

新增一张表 `project_messages`：

```sql
CREATE TABLE project_messages (
  id TEXT PRIMARY KEY,          -- msg_ + hex
  project_id TEXT NOT NULL,     -- 所属项目
  role TEXT NOT NULL,           -- 'user' | 'assistant' | 'tool_result'
  content TEXT NOT NULL,        -- 消息内容
  created_at TEXT NOT NULL      -- ISO 8601
);
```

每个 project 的消息按 created_at 排序即为完整对话历史。

### 后端

**HTTP API 新增两个端点：**

- `GET /api/projects/:id/messages` — 获取项目对话历史（最近 100 条）
- `POST /api/projects/:id/messages` — 发送用户消息，触发 AI 回复（SSE 流式）

AI 回复时注入的上下文：
- 项目名称和 goal
- 当前任务列表（title + status + kind，最多 50 条）
- 今天的日期
- 项目 system prompt（如果有）

AI 执行 CLI 命令时，tool_result 消息内联存储，前端展示为操作结果卡片。

### 移动端 UI

在现有 FAB（`+` 按钮，`fixed bottom-6 right-6`）上方加一个对话入口按钮：

```
fixed bottom-24 right-6   ← 💬 对话按钮（新增）
fixed bottom-6  right-6   ← +  新建任务（现有）
```

点击 💬 进入全屏对话页面（覆盖当前视图），左上角 ← 返回时间线。

### PC 端 UI

右侧栏（现在是任务详情）改为**对话区域**，固定显示当前项目的对话：

- 上方：消息列表（可滚动）
- 下方：输入框 + 发送按钮

点击任务时，任务详情以**浮出卡片**形式覆盖在对话区域上方（和现在移动端的任务详情卡片交互一致），不影响对话区域的存在。

---

## 涉及文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/core/src/db/init.ts` | 修改 | 新增 project_messages 表 |
| `packages/core/src/models/project-messages.ts` | 新增 | CRUD model |
| `packages/core/src/controllers/http/project-messages.ts` | 新增 | GET + POST 端点，POST 触发 AI 并 SSE 流式返回 |
| `packages/core/src/server.ts` | 修改 | 注册新路由 |
| `packages/web/src/lib/api.ts` | 修改 | 新增 messages API 方法 |
| `packages/web/src/components/chat/ChatPanel.tsx` | 新增 | 对话面板组件（PC + 移动端共用） |
| `packages/web/src/components/chat/ChatMessage.tsx` | 新增 | 单条消息组件（含操作结果卡片） |
| `packages/web/src/App.tsx` | 修改 | 移动端加 💬 FAB；PC 端右侧栏改为 ChatPanel |

---

## 边界情况

- [ ] 项目无任务时，AI 的开场白要说明项目是空的
- [ ] AI 执行 CLI 失败时，错误信息内联展示，不中断对话
- [ ] 消息历史超过 100 条后，只加载最近 100 条，但 AI 上下文保留全部（或最近 20 轮）
- [ ] 切换项目时，对话内容切换到新项目的 thread
- [ ] PC 端任务详情卡片弹出时，对话区域输入框仍可交互

---

## 验收标准

- [ ] 移动端右下角出现 💬 按钮，点击进入全屏对话页面
- [ ] PC 端右侧栏显示对话，可以边看时间线边聊
- [ ] 发送"今天有什么任务"，AI 能正确列出当前项目的任务
- [ ] 发送"帮我加一个每天早上 9 点的提醒"，AI 调用 CLI 创建任务，对话里显示结果
- [ ] 关闭再打开，历史消息保留
- [ ] 切换项目，对话内容切换
