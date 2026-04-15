# 项目分组（Project Groups）

> 设计文档。描述 ProjectGroup 对象的数据模型、API、CLI 和 UI 行为。
> 状态：草稿，待确认后执行。

---

## 背景与动机

随着项目数量增加，侧边栏的项目列表变得难以管理：

- 有些项目（如 Conductor 维护项目）长期后台运行，不需要频繁关注
- 有些项目属于不同的生活/工作领域，希望能分组归类
- 用户希望能控制哪些项目"固定可见"，哪些"折叠隐藏"

引入两个新能力：
1. **ProjectGroup** — 项目可以归属于一个分组，侧边栏按分组展示
2. **Project.pinned** — 控制项目是否固定显示在分组内（false = 折叠到"更多"）

---

## 数据模型

### ProjectGroup（新增）

```ts
interface ProjectGroup {
  id: string           // "group_" + hex
  name: string         // 分组名称，如 "工作"、"个人"
  order: number        // 侧边栏展示顺序（数值越小越靠前）
  collapsed: boolean   // 默认是否折叠（true = 侧边栏默认收起）
  createdBy: 'human' | 'ai' | 'system'
  createdAt: string
  updatedAt: string
}
```

### Project（修改）

新增字段，现有字段不变：

```ts
interface Project {
  // ... 现有字段不变 ...
  groupId?: string     // 归属分组 id，null = 未分组
  order: number        // 在分组内（或未分组列表中）的展示顺序
  pinned: boolean      // false = 在分组内折叠到"更多"区，默认 true
}
```

### 底层数据结构调整

`GET /api/projects` 和 `GET /api/groups` 的返回结构从**扁平列表**改为**以分组为单位的嵌套结构**：

```ts
// 新的 ProjectsView — 前端和 CLI 使用的主视图结构
interface ProjectsView {
  groups: GroupWithProjects[]   // 有分组的项目，按 group.order 排序
  ungrouped: Project[]          // groupId=null 的项目，按 project.order 排序
}

interface GroupWithProjects extends ProjectGroup {
  projects: Project[]           // 分组内项目，按 project.order 排序
}
```

原有的 `GET /api/projects`（返回扁平列表）继续保留，用于需要遍历所有项目的场景（如任务过滤）。

---

## 侧边栏展示逻辑

```
[全部]
─────────────────────
▼ 工作                    ← 展开的分组（collapsed=false）
    [AI] 日常事务
    [人] 理财计划
    ▸ 更多 (1)             ← pinned=false 的项目折叠在这里
─────────────────────
▶ 个人                    ← 折叠的分组（collapsed=true），点击展开
─────────────────────
    测试                   ← 未分组项目（groupId=null），无标题直接列出
─────────────────────
[新建项目]
[系统 Prompt]
```

**规则：**
- 分组按 `group.order` 升序排列，支持拖拽调整顺序
- 分组内项目按 `project.order` 升序排列，支持拖拽调整顺序
- `pinned=true` 的项目直接显示，`pinned=false` 的折叠到"更多"
- 未分组项目（`groupId=null`）显示在所有分组之后，按 `project.order` 排序
- `collapsed=true` 的分组默认折叠，点击标题展开/收起（状态存本地，不写库）
- "更多"区点击展开，再次点击收起（状态存本地）

---

## 数据库 Schema

### 新表：`project_groups`

```sql
CREATE TABLE IF NOT EXISTS project_groups (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  collapsed   INTEGER NOT NULL DEFAULT 0,   -- 默认展开
  created_by  TEXT NOT NULL DEFAULT 'human',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
) STRICT
```

### `projects` 表新增字段（migration）

```sql
ALTER TABLE projects ADD COLUMN group_id    TEXT REFERENCES project_groups(id)
ALTER TABLE projects ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0
ALTER TABLE projects ADD COLUMN pinned      INTEGER NOT NULL DEFAULT 1
```

---

## HTTP API

### 主视图接口（新增）

```
GET /api/view/projects
```

返回 `ProjectsView`（嵌套结构，含分组和未分组项目）。这是前端侧边栏和全局视图的主数据源。

```json
{
  "groups": [
    {
      "id": "group_a1b2c3",
      "name": "工作",
      "order": 0,
      "collapsed": false,
      "createdBy": "human",
      "createdAt": "...",
      "updatedAt": "...",
      "projects": [
        { "id": "proj_xxx", "name": "日常事务", "order": 0, "pinned": true, ... },
        { "id": "proj_yyy", "name": "理财计划", "order": 1, "pinned": false, ... }
      ]
    }
  ],
  "ungrouped": [
    { "id": "proj_zzz", "name": "测试", "order": 0, "pinned": true, ... }
  ]
}
```

### ProjectGroup CRUD

```
GET    /api/groups              列出所有分组（含 projects）
POST   /api/groups              创建分组
GET    /api/groups/:id          获取单个分组（含 projects）
PATCH  /api/groups/:id          更新分组（name、collapsed）
DELETE /api/groups/:id          删除分组（分组内项目 groupId 置 null，移到未分组）
```

**创建分组请求体：**
```json
{
  "name": "工作",          // 必填
  "collapsed": false,      // 可选，默认 false
  "createdBy": "human"     // 可选，默认 "human"，AI 创建时传 "ai"
}
```

**更新分组请求体（所有字段可选）：**
```json
{
  "name": "新名称",
  "collapsed": true
}
```

### 排序接口（新增）

```
POST /api/groups/reorder
```

重新排列分组顺序（拖拽后调用）。

请求体：
```json
{
  "ids": ["group_c", "group_a", "group_b"]  // 按新顺序传入所有分组 id
}
```

```
POST /api/groups/:id/projects/reorder
```

重新排列分组内项目顺序（拖拽后调用）。

请求体：
```json
{
  "ids": ["proj_b", "proj_a", "proj_c"]  // 按新顺序传入该分组内所有项目 id
}
```

```
POST /api/ungrouped/reorder
```

重新排列未分组项目顺序。

请求体：
```json
{
  "ids": ["proj_z", "proj_y"]
}
```

### Project 更新（扩展现有接口）

`PATCH /api/projects/:id` 新增可更新字段：

```json
{
  "groupId": "group_xxx",   // 设置归属分组，null = 移出分组（移到未分组）
  "order": 2,               // 在分组内（或未分组中）的排序位置
  "pinned": false           // 是否固定显示
}
```

### 原有接口保留

```
GET /api/projects           返回扁平列表（所有项目，不含分组信息）
                            用于任务过滤等需要遍历所有项目的场景
```

---

## CLI

### 分组管理

```bash
# 列出所有分组（含分组内项目）
conductor group list [--json]

# 创建分组
conductor group create \
  --name "工作" \
  [--collapsed]           # 默认折叠
  [--created-by ai]       # AI 创建时传此参数
  [--json]

# 更新分组
conductor group update <id> \
  [--name "新名称"] \
  [--collapse] \          # 设为默认折叠
  [--expand] \            # 设为默认展开
  [--json]

# 删除分组（分组内项目移到未分组）
conductor group delete <id> [--json]

# 重新排列分组顺序（按传入顺序设置 order）
conductor group reorder <id1> <id2> <id3> ... [--json]
```

### 项目与分组关联

```bash
# 将项目加入分组（同时可设置排序位置）
conductor project update <project-id> \
  --group <group-id> \
  [--order <n>] \
  [--json]

# 将项目移出分组（移到未分组）
conductor project update <project-id> \
  --no-group \
  [--json]

# 设置项目是否固定显示
conductor project update <project-id> --pin [--json]
conductor project update <project-id> --no-pin [--json]

# 重新排列分组内项目顺序
conductor group reorder-projects <group-id> <proj-id1> <proj-id2> ... [--json]

# 重新排列未分组项目顺序
conductor project reorder-ungrouped <proj-id1> <proj-id2> ... [--json]
```

### 创建项目时指定分组

```bash
conductor project create \
  --name "新项目" \
  [--group <group-id>] \
  [--order <n>] \
  [--no-pin] \            # 创建时设为 pinned=false
  [--json]
```

---

## AI Agent 使用

AI 通过 CLI 或 HTTP API 创建和管理分组，能力与人类完全对等。

**典型场景：AI 帮用户规划项目结构**

```bash
# 1. 创建分组
conductor group create --name "Q2 产品研发" --created-by ai --json
# → { "id": "group_abc", ... }

# 2. 将现有项目归入分组
conductor project update proj_xxx --group group_abc --json
conductor project update proj_yyy --group group_abc --order 1 --json

# 3. 将后台项目设为不固定显示
conductor project update proj_conductor --no-pin --json

# 4. 查看当前分组结构
conductor group list --json
```

**`conductor help-ai` 会包含分组相关的意图映射（更新后）：**

```json
{
  "create group": "conductor group create --name \"<name>\" [--collapsed] --json",
  "list groups": "conductor group list --json",
  "add project to group": "conductor project update <project-id> --group <group-id> --json",
  "hide project from sidebar": "conductor project update <project-id> --no-pin --json",
  "reorder groups": "conductor group reorder <id1> <id2> ... --json"
}
```

---

## UI 行为

### 侧边栏

- 分组标题行：点击折叠/展开，右侧有齿轮图标（hover 显示，点击进入分组设置）
- 分组内项目：支持拖拽排序（拖拽结束后调用 reorder 接口）
- 分组之间：支持拖拽调整分组顺序
- 项目可以拖拽到另一个分组（跨分组移动，同时更新 `groupId` 和 `order`）
- "更多"折叠区：显示 `pinned=false` 的项目，点击展开/收起（状态存 localStorage）
- 分组折叠状态：存 localStorage，不写库（轻量，不需要同步）

### 全局视图（"全部"）

- 按分组展示，每个分组是一个 section
- 未分组项目显示在最后一个 section
- 与侧边栏分组结构保持一致

### 项目设置（ProjectSettings）

新增"显示"tab 或在"基本信息"tab 内增加：

```
归属分组：[下拉选择 / 无分组]
在侧边栏中固定显示：[开关，默认开]
```

### 分组设置（新增 GroupSettings 弹窗）

点击分组标题旁的齿轮图标打开：

```
分组名称：[输入框]
默认折叠：[开关]
─────────────
[删除分组]    ← 危险操作，确认后分组内项目移到未分组
```

---

## 迁移策略

1. 新建 `project_groups` 表
2. `projects` 表添加 `group_id`、`order_index`、`pinned` 字段（migration，默认值安全）
3. 现有项目全部保持 `group_id=null`（未分组），行为与现在完全一致
4. `bootstrap` 将 `proj_conductor` 的 `pinned` 设为 `false`（后台项目默认不固定显示）
5. 不自动创建任何默认分组，由用户自己决定分组结构

---

## 实现顺序

1. **数据库** — 建表、migration、model 层（CRUD + reorder）
2. **HTTP API** — groups CRUD、reorder 接口、`/api/view/projects`、扩展 projects PATCH
3. **CLI** — group 命令、project update 新参数、更新 `help-ai`
4. **前端** — Sidebar 按分组渲染、拖拽排序、GroupSettings 弹窗、ProjectSettings 加分组字段
5. **bootstrap** — `proj_conductor` 设 `pinned=false`

---

## 已确认决策

| 问题 | 决策 |
|------|------|
| `GET /api/groups` 默认带 projects | 是 |
| 删除分组时项目处理 | 移到未分组（groupId=null） |
| 全局视图按分组展示 | 是 |
| 支持拖拽排序 | 是 |
| AI 可操作 | 是，CLI + HTTP API 全开放 |
| 分组折叠状态存哪里 | localStorage（不需要同步） |
| 跨分组拖拽时 order 处理 | 插入目标分组末尾（order = 目标分组当前项目数） |
| `GET /api/projects` 支持 `?groupId=` 过滤 | 不加，按分组查用 `GET /api/groups/:id` |
| 每一步都要有测试 | 是 |
