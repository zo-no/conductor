# PLAN: 测试覆盖补全

**状态**: DRAFT  
**日期**: 2026-04-16

---

## 需求描述

当前测试覆盖率：
- HTTP API：81%（30/37 路由），缺 7 条
- CLI：0%（0/30 命令），完全没有集成测试

目标：补全 HTTP 缺口，新建 CLI 集成测试，确保每个命令和路由都有基本覆盖。

---

## 现状分析

### HTTP 缺口（7 条）

| 路由 | 原因 |
|------|------|
| `POST /api/projects/:id/brain` | 未写测试 |
| `GET /api/tasks/:id/runs` | 未写测试 |
| `GET /api/tasks/:id/runs/:runId/spool` | 未写测试 |
| `GET /api/events` (SSE) | 难以集成测试，跳过 |
| `POST /api/groups/reorder` | 路由已从 source 删除，http.test.ts 里的调用是死代码，需清理 |
| `POST /api/groups/:id/projects/reorder` | 同上，需清理 |
| `POST /api/ungrouped/reorder` | 同上，需清理 |

实际需要新增的测试：3 条（brain + runs × 2）  
需要清理的死代码：3 条 reorder 调用

### CLI 缺口（30 个命令）

需新建 `packages/core/test/cli.test.ts`，覆盖：

| 命令组 | 命令 |
|--------|------|
| `task` | list, get, create, update, delete, run, done, cancel, logs, ops |
| `project` | list, get, create, update, delete, archive, unarchive |
| `group` | list, get, create, update, delete |
| `prompt` | get, set, delete |

暂不覆盖：
- `project init`（交互式，需要 AI 执行）
- `project brain add`（依赖 AI 执行环境）
- `tts`（依赖系统 TTS 环境）
- `daemon`（进程管理，不适合单元测试）

---

## 方案设计

### 1. 清理 http.test.ts 里的死代码

删除 3 个 reorder 路由的调用（路由已不存在）。

### 2. 补全 http.test.ts 的 3 个缺口

在现有测试文件末尾添加：
- `POST /api/projects/:id/brain` — 创建大脑任务，验证幂等性
- `GET /api/tasks/:id/runs` — 先 run 一个 script 任务，再查 runs
- `GET /api/tasks/:id/runs/:runId/spool` — 从 runs 里取 runId，查 spool

### 3. 新建 cli.test.ts

复用现有的 `helpers.ts` 里的 `cli()` 函数（已有 bun 执行封装）。

测试策略：
- 每个命令至少一个 happy path（`--json` 输出验证）
- 关键命令加 error path（找不到 id → 非零退出码）
- 不测试 AI 执行（避免实际调用 claude CLI）

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `packages/core/test/http.test.ts` | 删除 3 个 reorder 死代码调用，新增 brain + runs 测试 |
| `packages/core/test/cli.test.ts` | 新建，覆盖 task/project/group/prompt 命令 |

---

## 验收标准

- [ ] `bun test packages/core/test/http.test.ts` 通过，无 reorder 相关调用
- [ ] `bun test packages/core/test/cli.test.ts` 通过，覆盖 ≥ 25 个命令
- [ ] HTTP 覆盖率 ≥ 90%（33/37，SSE 跳过）
- [ ] CLI 覆盖率 ≥ 80%（25/30，daemon/tts/init/brain 跳过）
