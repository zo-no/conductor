import { Cron } from 'croner'
import type { Task, RecurringConfig } from '@conductor/types'
import { listTasks, getTask, updateTask, reconcileRunningTasks, getBlockedByTask, getDependentTasks } from '../models/tasks'
import { createTaskLog, updateTaskLogCompleted } from '../models/task-logs'
import { createTaskOp } from '../models/task-ops'
import { createTask } from '../models/tasks'
import { executeTask } from './executor'
import { emit } from './events'
import { speak } from './tts'

const TAG = '[scheduler]'

// Active cron jobs keyed by task id
const cronJobs = new Map<string, Cron>()

// Tasks currently executing (prevent concurrent runs)
const runningTasks = new Set<string>()

// ─── Reconcile on startup ─────────────────────────────────────────────────────

export function reconcile(): void {
  const stale = reconcileRunningTasks()
  for (const task of stale) {
    createTaskOp({
      taskId: task.id,
      op: 'status_changed',
      fromStatus: 'running',
      toStatus: 'pending',
      actor: 'scheduler',
      note: 'reconciled on startup',
    })
    console.log(`${TAG} reconciled task ${task.id} running→pending`)
  }
}

// ─── Run a single task ────────────────────────────────────────────────────────

export async function runTask(
  taskId: string,
  triggeredBy: 'manual' | 'scheduler' | 'api' | 'cli',
): Promise<void> {
  const task = getTask(taskId)
  if (!task) { console.warn(`${TAG} task ${taskId} not found`); return }
  if (!task.enabled) { console.log(`${TAG} task ${taskId} disabled, skip`); return }
  if (task.assignee !== 'ai') { console.log(`${TAG} task ${taskId} is human task, skip`); return }
  if (task.status === 'running') {
    // concurrent skip
    createTaskLog({
      taskId,
      status: 'skipped',
      triggeredBy,
      skipReason: 'already running',
    })
    return
  }
  if (task.status === 'blocked') {
    createTaskLog({ taskId, status: 'skipped', triggeredBy, skipReason: 'blocked' })
    return
  }

  // dependsOn check
  if (task.dependsOn) {
    const dep = getTask(task.dependsOn)
    if (!dep || dep.status !== 'done') {
      createTaskLog({
        taskId,
        status: 'skipped',
        triggeredBy,
        skipReason: `depends on ${task.dependsOn} (status: ${dep?.status ?? 'missing'})`,
      })
      return
    }
  }

  // Mark running
  updateTask(taskId, { status: 'running' })
  emit({ type: 'task_updated', data: { taskId, projectId: task.projectId } })
  createTaskOp({
    taskId,
    op: 'triggered',
    fromStatus: task.status,
    toStatus: 'running',
    actor: triggeredBy === 'manual' || triggeredBy === 'cli' ? 'human' : 'scheduler',
  })

  const logEntry = createTaskLog({
    taskId,
    status: 'success', // will update on completion
    triggeredBy,
    startedAt: new Date().toISOString(),
  })

  runningTasks.add(taskId)
  try {
    const result = await executeTask(taskId)

    // Check if cancelled while running
    const fresh = getTask(taskId)!
    if (fresh.status === 'cancelled') {
      updateTaskLogCompleted(logEntry.id, 'failed', result.output, 'cancelled by user')
      console.log(`${TAG} task ${taskId} was cancelled`)
      return
    }

    const finalStatus = result.success ? 'success' : 'failed'

    updateTaskLogCompleted(logEntry.id, finalStatus, result.output, result.error)

    const newTaskStatus = result.success ? 'done' : 'failed'

    // recurring tasks stay pending after done
    const nextStatus = fresh.kind === 'recurring' && result.success ? 'pending' : newTaskStatus

    updateTask(taskId, {
      status: nextStatus,
      ...(result.sessionId ? { lastSessionId: result.sessionId } : {}),
    })
    emit({ type: 'task_updated', data: { taskId, projectId: fresh.projectId } })
    createTaskOp({
      taskId,
      op: result.success ? 'done' : 'status_changed',
      fromStatus: 'running',
      toStatus: nextStatus,
      actor: 'scheduler',
    })

    // Update recurring schedule metadata
    if (fresh.kind === 'recurring' && fresh.scheduleConfig?.kind === 'recurring') {
      const cfg = fresh.scheduleConfig as RecurringConfig
      const job = cronJobs.get(taskId)
      updateTask(taskId, {
        scheduleConfig: {
          ...cfg,
          lastRunAt: new Date().toISOString(),
          nextRunAt: job?.nextRun()?.toISOString(),
        },
      })
    }

    // voiceNotice: speak on done or failed
    if (fresh.executorOptions?.voiceNotice?.enabled) {
      const defaultText = result.success ? `${fresh.title} 已完成` : `${fresh.title} 执行失败`
      const speechText = fresh.executorOptions.voiceNotice.speechText || defaultText
      speak(speechText).catch(() => {})  // fire-and-forget，不阻塞主流程
    }

    // reviewOnComplete: create human review task
    if (result.success && fresh.executorOptions?.reviewOnComplete) {
      const reviewTask = createTask({
        projectId: fresh.projectId,
        title: `Review: ${fresh.title}`,
        assignee: 'human',
        kind: 'once',
        sourceTaskId: fresh.id,
        createdBy: 'ai',
        waitingInstructions: `Task "${fresh.title}" completed. Please review the output and mark done.`,
      })
      createTaskOp({ taskId, op: 'review_created', actor: 'scheduler', note: reviewTask.id })
      speak(`${fresh.title} 已完成，请查看待办任务`).catch(() => {})
    }

    // Unblock tasks waiting on this one
    if (result.success) {
      await unblockDependents(taskId, result.output)
    }

    console.log(`${TAG} task ${taskId} finished: ${nextStatus}`)
  } finally {
    runningTasks.delete(taskId)
  }
}

// ─── Unblock ──────────────────────────────────────────────────────────────────

async function unblockDependents(completedTaskId: string, output: string): Promise<void> {
  // 1. blockedByTaskId: tasks explicitly blocked waiting for this one
  const blocked = getBlockedByTask(completedTaskId)
  for (const task of blocked) {
    updateTask(task.id, {
      status: 'pending',
      blockedByTaskId: null,
      completionOutput: output || undefined,
    })
    createTaskOp({
      taskId: task.id,
      op: 'unblocked',
      fromStatus: 'blocked',
      toStatus: 'pending',
      actor: 'scheduler',
      note: `unblocked by ${completedTaskId}`,
    })
    console.log(`${TAG} unblocked task ${task.id}`)
    await runTask(task.id, 'scheduler')
  }

  // 2. dependsOn: tasks that declared this task as a prerequisite
  const dependents = getDependentTasks(completedTaskId)
  for (const task of dependents) {
    updateTask(task.id, { completionOutput: output || undefined })
    createTaskOp({
      taskId: task.id,
      op: 'unblocked',
      fromStatus: 'pending',
      toStatus: 'pending',
      actor: 'scheduler',
      note: `dependency ${completedTaskId} completed`,
    })
    console.log(`${TAG} triggering dependent task ${task.id}`)
    await runTask(task.id, 'scheduler')
  }
}

// ─── Scheduler setup ──────────────────────────────────────────────────────────

function scheduleSingleTask(task: Task): void {
  if (task.assignee !== 'ai' || !task.enabled) return

  // Clean up existing job
  const existing = cronJobs.get(task.id)
  if (existing) { existing.stop(); cronJobs.delete(task.id) }

  if (task.kind === 'scheduled') {
    const cfg = task.scheduleConfig
    if (!cfg || cfg.kind !== 'scheduled') return
    const runAt = new Date(cfg.scheduledAt)
    if (runAt <= new Date()) return // past, skip

    const job = new Cron(runAt, { maxRuns: 1 }, async () => {
      await runTask(task.id, 'scheduler')
      cronJobs.delete(task.id)
    })
    cronJobs.set(task.id, job)

  } else if (task.kind === 'recurring') {
    const cfg = task.scheduleConfig
    if (!cfg || cfg.kind !== 'recurring') return

    const job = new Cron(cfg.cron, { timezone: cfg.timezone }, async () => {
      await runTask(task.id, 'scheduler')
    })
    cronJobs.set(task.id, job)

    // Update nextRunAt
    updateTask(task.id, {
      scheduleConfig: { ...cfg, nextRunAt: job.nextRun()?.toISOString() },
    })
  }
}

export function startScheduler(): void {
  const tasks = listTasks({ assignee: 'ai' })
  for (const task of tasks) {
    if (task.kind !== 'once') scheduleSingleTask(task)
  }
  console.log(`${TAG} started, registered ${cronJobs.size} cron jobs`)
}

export function registerTask(task: Task): void {
  if (task.kind !== 'once') scheduleSingleTask(task)
}

export function unregisterTask(taskId: string): void {
  const job = cronJobs.get(taskId)
  if (job) { job.stop(); cronJobs.delete(taskId) }
}

export function getSchedulerStatus(): { jobs: number; running: number } {
  return { jobs: cronJobs.size, running: runningTasks.size }
}
