import { Hono } from 'hono'
import type { TaskAssignee, TaskKind, TaskStatus, ScheduleConfig, TaskExecutor, ExecutorOptions } from '@conductor/types'
import {
  listTasks, getTask, createTask, updateTask, deleteTask, getBlockedByTask,
} from '../../models/tasks'
import { getTaskLogs } from '../../models/task-logs'
import { getTaskOps } from '../../models/task-ops'
import { createTaskOp } from '../../models/task-ops'
import { runTask, registerTask, unregisterTask } from '../../services/scheduler'
import { killTask } from '../../services/executor'
import { emit } from '../../services/events'

const app = new Hono()

app.get('/', (c) => {
  const { projectId, kind, status, assignee } = c.req.query()
  return c.json(listTasks({
    projectId: projectId || undefined,
    kind: kind as TaskKind | undefined,
    status: status as TaskStatus | undefined,
    assignee: assignee as TaskAssignee | undefined,
  }))
})

app.post('/', async (c) => {
  const body = await c.req.json()
  if (!body.title) return c.json({ error: 'title is required' }, 400)
  if (!body.projectId) return c.json({ error: 'projectId is required' }, 400)

  const task = createTask({
    projectId: body.projectId,
    title: body.title,
    description: body.description,
    assignee: body.assignee ?? 'human',
    kind: body.kind ?? 'once',
    order: body.order,
    scheduleConfig: body.scheduleConfig as ScheduleConfig | undefined,
    executor: body.executor as TaskExecutor | undefined,
    executorOptions: body.executorOptions as ExecutorOptions | undefined,
    waitingInstructions: body.waitingInstructions,
    sourceTaskId: body.sourceTaskId,
    enabled: body.enabled,
    createdBy: body.createdBy ?? 'human',
  })

  createTaskOp({ taskId: task.id, op: 'created', actor: body.createdBy ?? 'human' })
  registerTask(task)
  emit({ type: 'task_created', data: { taskId: task.id, projectId: task.projectId } })

  return c.json(task, 201)
})

app.get('/:id', (c) => {
  const task = getTask(c.req.param('id'))
  if (!task) return c.json({ error: 'not found' }, 404)
  return c.json(task)
})

app.patch('/:id', async (c) => {
  const body = await c.req.json()
  const task = updateTask(c.req.param('id'), body)
  if (!task) return c.json({ error: 'not found' }, 404)
  // Re-register to update cron if schedule changed
  registerTask(task)
  emit({ type: 'task_updated', data: { taskId: task.id, projectId: task.projectId } })
  return c.json(task)
})

app.delete('/:id', (c) => {
  const id = c.req.param('id')
  const task = getTask(id)
  if (!task) return c.json({ error: 'not found' }, 404)
  createTaskOp({ taskId: id, op: 'deleted', actor: 'human' })
  unregisterTask(id)
  deleteTask(id)
  emit({ type: 'task_deleted', data: { taskId: id, projectId: task.projectId } })
  return c.json({ ok: true })
})

app.post('/:id/run', async (c) => {
  const task = getTask(c.req.param('id'))
  if (!task) return c.json({ error: 'not found' }, 404)
  // Fire and forget — caller polls for status
  void runTask(task.id, 'api')
  return c.json({ ok: true, taskId: task.id })
})

app.post('/:id/done', async (c) => {
  const id = c.req.param('id')
  const task = getTask(id)
  if (!task) return c.json({ error: 'not found' }, 404)
  if (task.assignee !== 'human') return c.json({ error: 'only human tasks can be marked done' }, 400)

  const body = await c.req.json().catch(() => ({}))
  const prevStatus = task.status
  const updated = updateTask(id, {
    status: 'done',
    completionOutput: body.output ?? undefined,
  })
  createTaskOp({ taskId: id, op: 'done', fromStatus: prevStatus, toStatus: 'done', actor: 'human' })

  // Unblock AI tasks waiting on this human task
  const blocked = getBlockedByTask(id)
  for (const blocked_task of blocked) {
    updateTask(blocked_task.id, {
      status: 'pending',
      blockedByTaskId: null,
      completionOutput: body.output ?? undefined,
    })
    createTaskOp({
      taskId: blocked_task.id,
      op: 'unblocked',
      fromStatus: 'blocked',
      toStatus: 'pending',
      actor: 'human',
      note: `unblocked by human task ${id}`,
    })
    void runTask(blocked_task.id, 'api')
  }

  emit({ type: 'task_updated', data: { taskId: id, projectId: task.projectId } })
  return c.json(updated)
})

app.post('/:id/cancel', async (c) => {
  const id = c.req.param('id')
  const task = getTask(id)
  if (!task) return c.json({ error: 'not found' }, 404)
  const prevStatus = task.status
  killTask(id)
  const updated = updateTask(id, { status: 'cancelled' })
  createTaskOp({ taskId: id, op: 'cancelled', fromStatus: prevStatus, toStatus: 'cancelled', actor: 'human' })
  emit({ type: 'task_updated', data: { taskId: id, projectId: task.projectId } })
  return c.json(updated)
})

app.get('/:id/logs', (c) => {
  const { limit } = c.req.query()
  const task = getTask(c.req.param('id'))
  if (!task) return c.json({ error: 'not found' }, 404)
  return c.json(getTaskLogs(task.id, limit ? parseInt(limit) : 20))
})

app.get('/:id/ops', (c) => {
  const { limit } = c.req.query()
  const task = getTask(c.req.param('id'))
  if (!task) return c.json({ error: 'not found' }, 404)
  return c.json(getTaskOps(task.id, limit ? parseInt(limit) : 20))
})

export default app
