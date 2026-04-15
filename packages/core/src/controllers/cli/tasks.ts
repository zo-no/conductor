import { Command } from 'commander'
import type {
  TaskAssignee, TaskKind, TaskStatus,
  ScheduledConfig, RecurringConfig, TaskExecutor, ExecutorOptions,
} from '@conductor/types'
import {
  listTasks, getTask, createTask, updateTask, deleteTask, getBlockedByTask,
} from '../../models/tasks'
import { getTaskLogs } from '../../models/task-logs'
import { getTaskOps, createTaskOp } from '../../models/task-ops'
import { runTask, registerTask, unregisterTask } from '../../services/scheduler'
import { print, error } from './output'
import { initDb } from '../../db/init'
import { reconcile, startScheduler } from '../../services/scheduler'

function ensureDb(): void {
  initDb()
  reconcile()
  startScheduler()
}

export function registerTaskCommands(program: Command): void {
  const task = program.command('task').description('manage tasks')

  task
    .command('list')
    .description('list tasks')
    .option('--project <id>', 'filter by project')
    .option('--kind <kind>', 'filter by kind (once|scheduled|recurring)')
    .option('--assignee <assignee>', 'filter by assignee (ai|human)')
    .option('--status <status>', 'filter by status')
    .option('--json', 'output as JSON')
    .action((opts) => {
      ensureDb()
      print(listTasks({
        projectId: opts.project,
        kind: opts.kind as TaskKind | undefined,
        assignee: opts.assignee as TaskAssignee | undefined,
        status: opts.status as TaskStatus | undefined,
      }), opts.json)
    })

  task
    .command('get <id>')
    .description('get a task')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const t = getTask(id)
      if (!t) error(`task ${id} not found`)
      print(t, opts.json)
    })

  task
    .command('logs <id>')
    .description('get task execution logs')
    .option('--limit <n>', 'max results', '20')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const t = getTask(id)
      if (!t) error(`task ${id} not found`)
      print(getTaskLogs(id, parseInt(opts.limit)), opts.json)
    })

  task
    .command('ops <id>')
    .description('get task operation log')
    .option('--limit <n>', 'max results', '20')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const t = getTask(id)
      if (!t) error(`task ${id} not found`)
      print(getTaskOps(id, parseInt(opts.limit)), opts.json)
    })

  task
    .command('create')
    .description('create a task')
    .requiredOption('--title <title>', 'task title')
    .requiredOption('--project <id>', 'project id')
    .option('--assignee <assignee>', 'ai or human', 'human')
    .option('--kind <kind>', 'once|scheduled|recurring', 'once')
    .option('--description <desc>', 'task description')
    .option('--executor-kind <kind>', 'script|ai_prompt|http')
    .option('--prompt <prompt>', 'AI prompt (for ai_prompt executor)')
    .option('--script <command>', 'shell command (for script executor)')
    .option('--work-dir <dir>', 'working directory (for script executor)')
    .option('--http-url <url>', 'URL (for http executor)')
    .option('--http-method <method>', 'GET|POST|PUT|DELETE', 'GET')
    .option('--http-body <body>', 'request body (for http executor)')
    .option('--model <model>', 'AI model (for ai_prompt executor)')
    .option('--cron <expr>', 'cron expression (for recurring)')
    .option('--scheduled-at <iso>', 'scheduled time ISO 8601 (for scheduled)')
    .option('--include-last-output', 'inject last output as {lastOutput}')
    .option('--custom-var <kv>', 'key=value custom variable (repeatable)', collect, [])
    .option('--review-on-complete', 'create human review task after completion')
    .option('--depends-on <id>', 'prerequisite task id')
    .option('--instructions <text>', 'waiting instructions for human tasks')
    .option('--source-task <id>', 'source AI task id (for human tasks created by AI)')
    .option('--created-by <actor>', 'human or ai', 'human')
    .option('--json', 'output as JSON')
    .action((opts) => {
      ensureDb()

      // Build executor
      let executor: TaskExecutor | undefined
      const execKind = opts.executorKind
      if (execKind === 'ai_prompt' || opts.prompt) {
        executor = { kind: 'ai_prompt', prompt: opts.prompt ?? '', model: opts.model }
      } else if (execKind === 'script' || opts.script) {
        executor = { kind: 'script', command: opts.script ?? '', workDir: opts.workDir }
      } else if (execKind === 'http' || opts.httpUrl) {
        executor = {
          kind: 'http',
          url: opts.httpUrl ?? '',
          method: opts.httpMethod ?? 'GET',
          body: opts.httpBody,
        }
      }

      // Build schedule config
      let scheduleConfig: ScheduledConfig | RecurringConfig | undefined
      if (opts.scheduledAt) {
        scheduleConfig = { kind: 'scheduled', scheduledAt: opts.scheduledAt }
      } else if (opts.cron) {
        scheduleConfig = { kind: 'recurring', cron: opts.cron }
      }

      // Build executor options
      const customVars: Record<string, string> = {}
      for (const kv of (opts.customVar as string[])) {
        const [k, ...rest] = kv.split('=')
        customVars[k] = rest.join('=')
      }
      const executorOptions: ExecutorOptions | undefined =
        opts.includeLastOutput || opts.reviewOnComplete || Object.keys(customVars).length
          ? {
              includeLastOutput: opts.includeLastOutput ?? false,
              reviewOnComplete: opts.reviewOnComplete ?? false,
              customVars: Object.keys(customVars).length ? customVars : undefined,
            }
          : undefined

      const t = createTask({
        projectId: opts.project,
        title: opts.title,
        description: opts.description,
        assignee: opts.assignee as TaskAssignee,
        kind: opts.kind as TaskKind,
        dependsOn: opts.dependsOn,
        scheduleConfig,
        executor,
        executorOptions,
        waitingInstructions: opts.instructions,
        sourceTaskId: opts.sourceTask,
        createdBy: opts.createdBy as 'human' | 'ai',
      })

      createTaskOp({ taskId: t.id, op: 'created', actor: opts.createdBy as 'human' | 'ai' })
      registerTask(t)

      print(t, opts.json)
    })

  task
    .command('update <id>')
    .description('update a task')
    .option('--title <title>')
    .option('--description <desc>')
    .option('--cron <expr>')
    .option('--scheduled-at <iso>')
    .option('--prompt <prompt>')
    .option('--enable', 'enable the task')
    .option('--disable', 'disable the task')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const t = getTask(id)
      if (!t) error(`task ${id} not found`)

      const updates: Parameters<typeof updateTask>[1] = {}
      if (opts.title) updates.title = opts.title
      if (opts.description) updates.description = opts.description
      if (opts.enable) updates.enabled = true
      if (opts.disable) updates.enabled = false
      if (opts.scheduledAt) updates.scheduleConfig = { kind: 'scheduled', scheduledAt: opts.scheduledAt }
      if (opts.cron && t!.scheduleConfig?.kind === 'recurring') {
        updates.scheduleConfig = { ...t!.scheduleConfig, cron: opts.cron }
      }
      if (opts.prompt && t!.executor?.kind === 'ai_prompt') {
        updates.executor = { ...t!.executor, prompt: opts.prompt }
      }

      const updated = updateTask(id, updates)!
      registerTask(updated)
      print(updated, opts.json)
    })

  task
    .command('delete <id>')
    .description('delete a task')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const t = getTask(id)
      if (!t) error(`task ${id} not found`)
      createTaskOp({ taskId: id, op: 'deleted', actor: 'human' })
      unregisterTask(id)
      deleteTask(id)
      print({ ok: true }, opts.json)
    })

  task
    .command('run <id>')
    .description('manually trigger a task')
    .option('--json', 'output as JSON')
    .action(async (id, opts) => {
      ensureDb()
      const t = getTask(id)
      if (!t) error(`task ${id} not found`)
      await runTask(id, 'cli')
      const updated = getTask(id)
      print(updated, opts.json)
      process.exit(0)
    })

  task
    .command('done <id>')
    .description('mark a human task as done')
    .option('--output <text>', 'completion output/notes')
    .option('--json', 'output as JSON')
    .action(async (id, opts) => {
      ensureDb()
      const t = getTask(id)
      if (!t) error(`task ${id} not found`)
      if (t!.assignee !== 'human') error('only human tasks can be marked done via this command')

      const prevStatus = t!.status
      const updated = updateTask(id, { status: 'done', completionOutput: opts.output })
      createTaskOp({ taskId: id, op: 'done', fromStatus: prevStatus, toStatus: 'done', actor: 'human' })

      // Unblock waiting AI tasks
      const blocked = getBlockedByTask(id)
      for (const bt of blocked) {
        updateTask(bt.id, { status: 'pending', blockedByTaskId: null, completionOutput: opts.output })
        createTaskOp({
          taskId: bt.id, op: 'unblocked',
          fromStatus: 'blocked', toStatus: 'pending',
          actor: 'human', note: `unblocked by human task ${id}`,
        })
        await runTask(bt.id, 'cli')
      }

      print(updated, opts.json)
      process.exit(0)
    })

  task
    .command('cancel <id>')
    .description('cancel a task')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const t = getTask(id)
      if (!t) error(`task ${id} not found`)
      const prevStatus = t!.status
      const updated = updateTask(id, { status: 'cancelled' })
      createTaskOp({ taskId: id, op: 'cancelled', fromStatus: prevStatus, toStatus: 'cancelled', actor: 'human' })
      print(updated, opts.json)
    })
}

function collect(val: string, acc: string[]): string[] {
  acc.push(val)
  return acc
}
