# PLAN: 移除 depends_on 字段

**状态**: DRAFT  
**日期**: 2026-04-16

---

## 需求描述

`depends_on` 字段用于声明式任务链编排（A 完成 → 自动触发 B），但当前不需要这个功能。  
`blocked_by_task_id` 已能覆盖"等待前置任务"场景，`depends_on` 是冗余字段，予以删除。

---

## 方案设计

### 数据库迁移

SQLite 不支持 `DROP COLUMN`（旧版本），但 Bun 内置 SQLite 支持。  
在 `initDb()` 里加迁移：`ALTER TABLE tasks DROP COLUMN depends_on`（幂等，用 try/catch 包裹）。  
同时删除索引 `idx_tasks_depends`（DROP INDEX IF EXISTS）。

### 删除代码路径

按层级从底向上删除：

1. **DB schema** — 删除列定义、索引
2. **Types** — Task 接口移除 `dependsOn` 字段
3. **Model** — tasks.ts 移除 rowToTask 映射、CreateTaskInput 字段、INSERT 参数、getDependentTasks 函数、deleteTask 里的清理 UPDATE
4. **Scheduler** — 移除 runTask 里的 dependsOn 检查、unblockDependents 里的 dependents 触发逻辑
5. **HTTP controller** — 创建任务移除 dependsOn 参数、`/done` 端点移除 dependents 触发
6. **CLI controller** — 移除 `--depends-on` 选项、done 命令移除 dependents 触发
7. **前端 TaskForm** — 移除 depends-on screen、状态、UI Row、availableTasks effect
8. **前端 TaskDetail** — 移除 dependsOn 显示块、dependents 过滤条件里的 `dep.dependsOn === task.id`
9. **i18n** — 移除 `dependsOnLabel`
10. **测试** — 移除 scheduler.test.ts 和 models.test.ts 里的 dependsOn 相关用例

---

## 涉及文件

| 文件 | 改动 |
|------|------|
| `packages/core/src/db/init.ts` | 删除列定义 + 索引；加 DROP COLUMN 迁移 |
| `packages/types/src/index.ts` | Task 接口移除 `dependsOn` |
| `packages/core/src/models/tasks.ts` | rowToTask、CreateTaskInput、INSERT、getDependentTasks、deleteTask 清理 |
| `packages/core/src/services/scheduler.ts` | runTask 依赖检查、unblockDependents dependents 块 |
| `packages/core/src/controllers/http/tasks.ts` | POST 创建、`/done` 端点 |
| `packages/core/src/controllers/cli/tasks.ts` | `--depends-on` 选项、done 命令 |
| `packages/web-next/components/tasks/TaskForm.tsx` | depends-on screen、状态、UI |
| `packages/web-next/components/tasks/TaskDetail.tsx` | 显示块、dependents 过滤 |
| `packages/web-next/lib/i18n.ts` | `dependsOnLabel` |
| `packages/core/test/scheduler.test.ts` | 移除 dependsOn 测试用例 |
| `packages/core/test/models.test.ts` | 移除 getDependentTasks 测试 |

---

## 未来规划（暂不实现）

工作流编排（A → B → C 声明式任务链）是一个有价值的功能，但当前阶段不需要。  
后续如需实现，可参考以下方向：

- 支持多前置任务（当前 depends_on 只支持单个）
- 可视化依赖关系图
- 循环依赖检测

---

## 验收标准

- [ ] `DELETE /api/tasks/:id` 不再因 depends_on 相关外键报错（deleteTask 里的清理 UPDATE 也一并移除）
- [ ] 创建任务时传 `dependsOn` 参数被忽略或报错（不再支持）
- [ ] 前端 TaskForm 不再显示"前置任务"选项
- [ ] `bun test` 全部通过
- [ ] 现有数据库能正常迁移（DROP COLUMN 幂等）
