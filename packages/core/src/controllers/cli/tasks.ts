import { Command } from 'commander'
import type {
  TaskAssignee, TaskKind, TaskStatus,
  ScheduledConfig, RecurringConfig, TaskExecutor, ExecutorOptions,
} from '@conductor/types'
import {
  listTasks, getTask, createTask, updateTask, deleteTask, getBlockedByTask, getDependentTasks,
} from '../../models/tasks'
import { getTaskLogs } from '../../models/task-logs'
import { getTaskOps, createTaskOp } from '../../models/task-ops'
import { executeTask } from '../../services/executor'
import { createTaskLog, updateTaskLogCompleted } from '../../models/task-logs'
import { print, error } from './output'
import { initDb } from '../../db/init'

function ensureDb(): void {
  initDb()
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
    .option('--voice-notice', 'speak a voice notification when task completes (AI tasks only)')
    .option('--speech-text <text>', 'custom speech text for voice notification')
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
        opts.includeLastOutput || opts.reviewOnComplete || Object.keys(customVars).length || opts.voiceNotice
          ? {
              includeLastOutput: opts.includeLastOutput ?? false,
              reviewOnComplete: opts.reviewOnComplete ?? false,
              customVars: Object.keys(customVars).length ? customVars : undefined,
              voiceNotice: opts.voiceNotice
                ? { enabled: true, speechText: opts.speechText }
                : undefined,
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
    .option('--voice-notice', 'enable voice notification on completion')
    .option('--no-voice-notice', 'disable voice notification')
    .option('--speech-text <text>', 'custom speech text for voice notification')
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

      // voice notice
      if (opts.voiceNotice === true) {
        updates.executorOptions = {
          ...t!.executorOptions,
          voiceNotice: { enabled: true, speechText: opts.speechText ?? t!.executorOptions?.voiceNotice?.speechText },
        }
      } else if (opts.voiceNotice === false) {
        updates.executorOptions = {
          ...t!.executorOptions,
          voiceNotice: { enabled: false },
        }
      } else if (opts.speechText) {
        // only update speech text, keep enabled state
        updates.executorOptions = {
          ...t!.executorOptions,
          voiceNotice: { enabled: t!.executorOptions?.voiceNotice?.enabled ?? true, speechText: opts.speechText },
        }
      }

      const updated = updateTask(id, updates)!
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
      if (t!.assignee !== 'ai') error('only ai tasks can be run manually')
      if (!t!.executor) error('task has no executor configured')

      const prevStatus = t!.status
      updateTask(id, { status: 'running' })
      createTaskOp({ taskId: id, op: 'triggered', fromStatus: prevStatus, toStatus: 'running', actor: 'human' })
      const logEntry = createTaskLog({ taskId: id, status: 'success', triggeredBy: 'cli', startedAt: new Date().toISOString() })

      const result = await executeTask(id)
      const finalStatus = result.success ? 'success' : 'failed'
      updateTaskLogCompleted(logEntry.id, finalStatus, result.output, result.error)

      const newStatus = t!.kind === 'recurring' && result.success ? 'pending' : (result.success ? 'done' : 'failed')
      updateTask(id, { status: newStatus })
      createTaskOp({ taskId: id, op: result.success ? 'done' : 'status_changed', fromStatus: 'running', toStatus: newStatus, actor: 'human' })

      print(getTask(id), opts.json)
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

      // 1. blockedByTaskId: tasks explicitly blocked waiting for this one
      const blocked = getBlockedByTask(id)
      for (const bt of blocked) {
        updateTask(bt.id, { status: 'pending', blockedByTaskId: null, completionOutput: opts.output })
        createTaskOp({
          taskId: bt.id, op: 'unblocked',
          fromStatus: 'blocked', toStatus: 'pending',
          actor: 'human', note: `unblocked by human task ${id}`,
        })
        void executeTask(bt.id).then((result) => {
          updateTask(bt.id, { status: result.success ? 'done' : 'failed' })
        })
      }

      // 2. dependsOn: tasks that declared this task as a prerequisite
      const dependents = getDependentTasks(id)
      for (const dt of dependents) {
        updateTask(dt.id, { completionOutput: opts.output })
        createTaskOp({
          taskId: dt.id, op: 'unblocked',
          fromStatus: 'pending', toStatus: 'pending',
          actor: 'human', note: `dependency ${id} completed`,
        })
        void executeTask(dt.id).then((result) => {
          updateTask(dt.id, { status: result.success ? 'done' : 'failed' })
        })
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
