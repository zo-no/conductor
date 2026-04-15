/**
 * Scheduler logic tests
 * Tests reviewOnComplete, dependsOn auto-trigger, recurring nextRunAt update
 */
import { unlinkSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { assert, section, summary } from './helpers'

const TEST_DB = join(homedir(), '.conductor', 'test-scheduler.sqlite')
process.env.CONDUCTOR_TEST_DB = TEST_DB
try { unlinkSync(TEST_DB) } catch {}

import { initDb, resetDb } from '../src/db/init'
import { createProject } from '../src/models/projects'
import { createTask, getTask, updateTask, listTasks } from '../src/models/tasks'
import { getTaskLogs } from '../src/models/task-logs'
import { getTaskOps } from '../src/models/task-ops'
import { runTask, startScheduler } from '../src/services/scheduler'

initDb()
startScheduler()

const proj = createProject({ name: 'Scheduler Test', workDir: '/tmp' })

console.log('\n=== scheduler logic tests ===')

// ── reviewOnComplete ──────────────────────────────────────────────────────────
section('reviewOnComplete')

{
  const task = createTask({
    projectId: proj.id,
    title: 'Task with review',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'echo "done"' },
    executorOptions: { reviewOnComplete: true },
  })

  await runTask(task.id, 'manual')
  await Bun.sleep(500)

  const updated = getTask(task.id)
  assert('reviewOnComplete: task finishes done', updated?.status === 'done')

  // A human review task should have been created
  const allTasks = listTasks({ projectId: proj.id, assignee: 'human' })
  const reviewTask = allTasks.find(t => t.sourceTaskId === task.id)
  assert('reviewOnComplete: review task created', !!reviewTask)
  assert('reviewOnComplete: review task assignee=human', reviewTask?.assignee === 'human')
  assert('reviewOnComplete: review task kind=once', reviewTask?.kind === 'once')
  assert('reviewOnComplete: review task has instructions', !!reviewTask?.waitingInstructions)

  // Check task_ops has review_created
  const ops = getTaskOps(task.id)
  assert('reviewOnComplete: review_created op logged', ops.some(op => op.op === 'review_created'))
}

// ── reviewOnComplete: no review on failure ────────────────────────────────────
section('reviewOnComplete: no review on failure')

{
  const task = createTask({
    projectId: proj.id,
    title: 'Task that fails with review',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'exit 1' },
    executorOptions: { reviewOnComplete: true },
  })

  await runTask(task.id, 'manual')
  await Bun.sleep(500)

  const updated = getTask(task.id)
  assert('failed task stays failed', updated?.status === 'failed')

  const allTasks = listTasks({ projectId: proj.id, assignee: 'human' })
  const reviewTask = allTasks.find(t => t.sourceTaskId === task.id)
  assert('no review task created on failure', !reviewTask)
}

// ── dependsOn: skips when dep not done ───────────────────────────────────────
section('dependsOn: skip when dep not done')

{
  // Create a prerequisite script task
  const prereq = createTask({
    projectId: proj.id,
    title: 'Prerequisite',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'echo "prereq done"' },
  })

  // Create a dependent task
  const dependent = createTask({
    projectId: proj.id,
    title: 'Dependent task',
    assignee: 'ai',
    kind: 'once',
    dependsOn: prereq.id,
    executor: { kind: 'script', command: 'echo "dependent ran"' },
  })

  // Try running dependent before prereq — should be skipped
  await runTask(dependent.id, 'manual')
  await Bun.sleep(300)
  const afterSkip = getTask(dependent.id)
  assert('dependent skipped before prereq done', afterSkip?.status === 'pending')
  const skipLogs = getTaskLogs(dependent.id)
  assert('skipped log created', skipLogs.some(l => l.status === 'skipped'))
  assert('skip reason mentions dep', skipLogs.some(l => l.skipReason?.includes(prereq.id)))

  // Run prereq
  await runTask(prereq.id, 'manual')
  await Bun.sleep(500)
  const prereqFinal = getTask(prereq.id)
  assert('prereq finishes done', prereqFinal?.status === 'done')

  // Now dependent can run (dependsOn is satisfied)
  await runTask(dependent.id, 'manual')
  await Bun.sleep(500)
  const depFinal = getTask(dependent.id)
  assert('dependent runs after prereq done', depFinal?.status === 'done')
}

// ── recurring: lastRunAt updated after manual run ────────────────────────────
section('recurring: lastRunAt updated after manual run')

{
  // Register the task with the scheduler so it gets a cron job (needed for nextRunAt)
  const { registerTask } = await import('../src/services/scheduler')

  const task = createTask({
    projectId: proj.id,
    title: 'Recurring task',
    assignee: 'ai',
    kind: 'recurring',
    scheduleConfig: { kind: 'recurring', cron: '0 9 * * *' },
    executor: { kind: 'script', command: 'echo "recurring"' },
  })

  // Register to create the cron job (sets initial nextRunAt)
  registerTask(task)

  await runTask(task.id, 'manual')
  await Bun.sleep(500)

  const updated = getTask(task.id)
  assert('recurring stays pending after run', updated?.status === 'pending')
  assert('recurring lastRunAt set', !!(updated?.scheduleConfig as any)?.lastRunAt)
  // nextRunAt is set by the cron job via registerTask
  assert('recurring nextRunAt set by scheduler', !!(updated?.scheduleConfig as any)?.nextRunAt)
}

// ── concurrent skip ───────────────────────────────────────────────────────────
section('concurrent skip')

{
  const task = createTask({
    projectId: proj.id,
    title: 'Slow task',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'sleep 2' },
  })

  // Start task, then immediately try to run again
  const run1 = runTask(task.id, 'manual')
  await Bun.sleep(100) // let it start
  await runTask(task.id, 'manual') // concurrent attempt

  const logs = getTaskLogs(task.id)
  assert('concurrent attempt creates skipped log', logs.some(l => l.status === 'skipped' && l.skipReason === 'already running'))

  await run1 // wait for first run to finish
}

// ── disabled task skip ────────────────────────────────────────────────────────
section('disabled task skip')

{
  const task = createTask({
    projectId: proj.id,
    title: 'Disabled task',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'echo "should not run"' },
    enabled: false,
  })

  await runTask(task.id, 'manual')
  await Bun.sleep(300)

  const updated = getTask(task.id)
  assert('disabled task stays pending', updated?.status === 'pending')
  const logs = getTaskLogs(task.id)
  assert('disabled task has no success log', !logs.some(l => l.status === 'success'))
}

// ── task_ops: triggered op logged ────────────────────────────────────────────
section('task_ops on run')

{
  const task = createTask({
    projectId: proj.id,
    title: 'Ops check task',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'echo "ops"' },
  })

  await runTask(task.id, 'cli')
  await Bun.sleep(500)

  const ops = getTaskOps(task.id)
  assert('triggered op logged', ops.some(op => op.op === 'triggered'))
  assert('done op logged', ops.some(op => op.op === 'done'))
  assert('status_changed from pending to running', ops.some(op =>
    op.op === 'triggered' && op.fromStatus === 'pending' && op.toStatus === 'running'
  ))
}

// cleanup
resetDb()
try { unlinkSync(TEST_DB) } catch {}

summary()
