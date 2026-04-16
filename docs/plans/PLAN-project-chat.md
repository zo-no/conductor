# PLAN: 项目会话功能

> 状态: DRAFT（暂缓实现）
> 创建时间: 2026-04-16
> 关联需求: 每个项目可以创建多个对话，通过自然语言操作任务
>
> **设计备注（2026-04-16）：**
> - `chat_messages.content` 改为存 JSON 数组，直接对应 Anthropic API message 格式，role 只有 `user` / `assistant`，tool_use 和 tool_result 作为 content block 内联
> - 运行时不需要 spool 表，SSE 直接推，流结束后整体写入，断线丢弃可接受
> - 系统 prompt 分层：固定注入（项目信息）+ 工具能力说明；任务列表不预加载，由 AI 按需 CLI 查询

---

## 需求描述

每个 Project 下可以创建多个对话（Chat）。用户通过自然语言和 AI 聊，AI 知道自己是哪个项目的助理，可以调用 Conductor CLI 查询和操作任务。

每个 Chat 有独立的消息历史、模型选择、自动生成的标题。

---

## 数据模型

### `project_chats` 表（会话）

```sql
CREATE TABLE IF NOT EXISTS project_chats (
  id              TEXT PRIMARY KEY NOT NULL,  -- chat_ + hex
  project_id      TEXT NOT NULL,              -- 所属项目
  title           TEXT NOT NULL DEFAULT '新对话',
  model           TEXT,                       -- 覆盖默认模型，null = 用全局默认
  auto_rename     INTEGER DEFAULT 1,          -- 1 = 等待自动命名，0 = 已命名
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
```

### `chat_messages` 表（消息）

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY NOT NULL,  -- msg_ + hex
  chat_id     TEXT NOT NULL,              -- 所属会话
  role        TEXT NOT NULL,              -- 'user' | 'assistant' | 'tool_use' | 'tool_result'
  content     TEXT NOT NULL,              -- 消息内容
  tool_name   TEXT,                       -- tool_use 时的命令名
  tool_input  TEXT,                       -- tool_use 时的命令参数
  created_at  TEXT NOT NULL
);
```

---

## 系统 Prompt 组装

每次 AI 回复前注入以下上下文（参考现有任务执行的三层 prompt 架构）：

```
你是「{projectName}」项目的 AI 任务助理。

项目目标：{goal}
工作目录：{workDir}
今天：{date}

你可以通过 Conductor CLI 管理这个项目的任务：
  conductor task list --project {projectId} --json   # 查看所有任务
  conductor task get <task-id> --json                # 查看任务详情和执行历史
  conductor task create ...                          # 创建任务
  conductor task run <task-id>                       # 立即执行 AI 任务
  conductor task done <task-id>                      # 标记人类任务完成
  conductor task cancel <task-id>                    # 取消任务
  conductor help-ai                                  # 查看完整命令速查表

执行 CLI 命令时，把命令和结果都展示给用户。

{globalSystemPrompt}   ← 全局 system prompt（system_prompts 表 key='default'）
{projectSystemPrompt}  ← 项目 system prompt（system_prompts 表 key='proj_{id}'）
```

AI 需要任务列表时，自己调 CLI 查，不预加载。

### 消息历史传递

参考 melody-sync 的策略：按大小限制而非条数截断。

- `message`（用户/助手文本）：内联存储，超 **64KB** 外部化
- `tool_use`（CLI 命令）：内联存储，超 **2KB** 外部化
- `tool_result`（命令输出）：内联存储，超 **4KB** 外部化

传给 AI 时：取最近 **20 轮**对话（一轮 = 一条 user + 一条 assistant），超出部分只在 UI 展示，不传给 AI。不做摘要，保持简单。

---

## 自动会话命名

**触发时机**：第一次 AI 回复完成后，异步触发（不阻塞对话流程）。

**Prompt**（参考 melody-sync summarizer.mjs）：

```
你是一个对话命名助手，根据以下对话内容生成一个简洁的标题。

项目：{projectName}
用户：{userMessage 截断至 400 字符}
助手：{assistantReply 截断至 600 字符}

生成一个标题，要求：
- 中文：最多 6 个汉字
- 英文：最多 3 个单词
- 聚焦具体任务，不要用通用词（如"对话"、"任务"、"聊天"）
- 只返回标题文字，不加引号或其他内容
```

拿到标题后：
- 更新 `project_chats.title`
- 设 `auto_rename = 0`
- 失败时保留默认标题「新对话」，不重试

---

## 模型选择

- 全局默认模型：`claude-opus-4-6`（可在系统 prompt 管理页配置）
- 每个 Chat 可单独覆盖模型（存 `project_chats.model`）
- UI 上在对话头部提供模型选择器

---

## HTTP API

| 端点 | 说明 |
|------|------|
| `GET /api/projects/:id/chats` | 列出项目下所有会话（按 updated_at 倒序） |
| `POST /api/projects/:id/chats` | 新建会话 |
| `DELETE /api/chats/:chatId` | 删除会话（级联删除消息） |
| `PATCH /api/chats/:chatId` | 更新会话（title、model） |
| `GET /api/chats/:chatId/messages` | 获取消息历史（最近 100 条） |
| `POST /api/chats/:chatId/messages` | 发送消息，SSE 流式返回 AI 回复 |

SSE 事件格式（和现有 TaskRun spool 一致）：
```
data: {"type":"delta","content":"..."}
data: {"type":"tool_use","name":"bash","input":"conductor task list ..."}
data: {"type":"tool_result","content":"[{...}]"}
data: {"type":"done"}
```

---

## UI 设计

### 移动端

在现有 FAB（`fixed bottom-6 right-6`）上方加一个对话按钮：

```
fixed bottom-24 right-6  ← 💬 对话按钮（新增，打开当前项目最新对话）
fixed bottom-6  right-6  ← +  新建任务（现有）
```

点击 💬：
- 有历史对话 → 进入最近一次对话
- 无历史对话 → 自动创建新对话并进入

对话页面（全屏覆盖）：
```
┌──────────────────────────────────────────┐
│ ←  理财计划              [模型] [新对话]  │
├──────────────────────────────────────────┤
│  AI：你好，我是理财计划助理...             │
│                                          │
│  你：帮我加一个每周记账的提醒             │
│                                          │
│  AI：好的，正在执行...                    │
│  > conductor task create ...             │
│  ✓ 已创建「每周记账」[→ 查看]             │
│                                          │
├──────────────────────────────────────────┤
│ [输入消息...                       发送] │
└──────────────────────────────────────────┘
```

左上角 ← 返回时间线。顶部右侧：模型选择器 + 新建对话按钮。

### PC 端

右侧栏改为**对话区域**，上方加会话列表（可折叠）：

```
┌────────────┬──────────────────┬──────────────────────┐
│ 项目列表    │ 时间线            │ 会话列表（折叠态）      │
│            │                  │ 4/16 理财任务规划  ●  │
│            │                  │ 4/15 每日工作梳理     │
│            │                  │ ─────────────────    │
│            │                  │ 【当前对话】           │
│            │                  │ AI：你好...           │
│            │                  │ 你：帮我加...          │
│            │                  │ ─────────────────    │
│            │                  │ [输入消息...   发送 →] │
└────────────┴──────────────────┴──────────────────────┘
```

点击任务时，任务详情以**浮出卡片**覆盖对话区域（和现在移动端一致）。

---

## 涉及文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/core/src/db/init.ts` | 修改 | 新增 project_chats + chat_messages 表 |
| `packages/core/src/models/chats.ts` | 新增 | Chat + Message CRUD |
| `packages/core/src/controllers/http/chats.ts` | 新增 | 所有 chat 相关端点，含 SSE 流式 |
| `packages/core/src/server.ts` | 修改 | 注册新路由 |
| `packages/types/src/index.ts` | 修改 | 新增 ProjectChat、ChatMessage 类型 |
| `packages/web/src/lib/api.ts` | 修改 | 新增 chats API 方法 |
| `packages/web/src/components/chat/ChatPanel.tsx` | 新增 | 对话面板（PC 右侧栏 + 移动端全屏复用） |
| `packages/web/src/components/chat/ChatMessage.tsx` | 新增 | 单条消息（含 tool_use/tool_result 卡片） |
| `packages/web/src/components/chat/ChatList.tsx` | 新增 | 会话列表（PC 右侧栏顶部） |
| `packages/web/src/App.tsx` | 修改 | 移动端加 💬 FAB；PC 端右侧栏改为 ChatPanel |

---

## 边界情况

- [ ] 项目无任务时，AI 开场白说明项目是空的，引导用户创建任务
- [ ] AI 执行 CLI 失败时，错误内联展示，不中断对话
- [ ] 切换项目时，对话内容切换到新项目的最近对话
- [ ] PC 端任务详情卡片弹出时，对话输入框仍可交互
- [ ] 自动命名请求失败时，保留默认标题「新对话」，不重试

---

## 验收标准

- [ ] 移动端右下角出现 💬 按钮，点击进入对话全屏页面
- [ ] PC 端右侧栏显示对话，可边看时间线边聊
- [ ] 可以新建多个对话，对话列表按时间倒序排列
- [ ] 对话标题在第一次回复完成后自动生成
- [ ] 模型选择器可切换，切换后新消息用新模型
- [ ] 发送「今天有什么任务」，AI 自己调 CLI 查询并回答
- [ ] 发送「帮我加一个每天早上 9 点的提醒」，AI 创建任务，对话里显示命令和结果
- [ ] 关闭再打开，历史消息保留
- [ ] 切换项目，对话内容切换
