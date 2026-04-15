#!/usr/bin/env bun
/**
 * CLI integration test — covers all conductor CLI commands
 * Run: bun run packages/core/test-cli.ts
 */

import { $ } from 'bun'

const CLI = 'bun run packages/core/cli.ts'
let passed = 0
let failed = 0

// ─── helpers ──────────────────────────────────────────────────────────────────

function ok(label: string) {
  console.log(`  ✓ ${label}`)
  passed++
}

function fail(label: string, detail?: string) {
  console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`)
  failed++
}

async function cli(...args: string[]): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    const result = await $`bun run packages/core/cli.ts ${args}`.quiet()
    return { stdout: result.stdout.toString(), stderr: result.stderr.toString(), ok: true }
  } catch (e: any) {
    return { stdout: e.stdout?.toString() ?? '', stderr: e.stderr?.toString() ?? '', ok: false }
  }
}

function parse(stdout: string): any {
  try { return JSON.parse(stdout.trim()) } catch { return null }
}

function assert(label: string, condition: boolean, detail?: string) {
  condition ? ok(label) : fail(label, detail)
}

// ─── tests ────────────────────────────────────────────────────────────────────

console.log('\n=== conductor CLI tests ===\n')

// ── project ──────────────────────────────────────────────────────────────────
console.log('── project ──')

const createProj = await cli('project', 'create', '--name', 'Test Project', '--goal', 'test goal', '--work-dir', '/tmp', '--json')
assert('project create', createProj.ok, createProj.stderr)
const proj = parse(createProj.stdout)
assert('project create returns id', proj?.id?.startsWith('proj_'), JSON.stringify(proj))
assert('project create name', proj?.name === 'Test Project')
assert('project create goal', proj?.goal === 'test goal')
assert('project create workDir', proj?.workDir === '/tmp')
const projId = proj?.id

const listProj = await cli('project', 'list', '--json')
assert('project list', listProj.ok, listProj.stderr)
const projects = parse(listProj.stdout)
assert('project list returns array', Array.isArray(projects))
assert('project list contains created', projects?.some((p: any) => p.id === projId))

const getProj = await cli('project', 'get', projId, '--json')
assert('project get', getProj.ok, getProj.stderr)
assert('project get returns correct id', parse(getProj.stdout)?.id === projId)

const updateProj = await cli('project', 'update', projId, '--name', 'Updated Project', '--json')
assert('project update', updateProj.ok, updateProj.stderr)
assert('project update name changed', parse(updateProj.stdout)?.name === 'Updated Project')

const archiveProj = await cli('project', 'archive', projId, '--json')
assert('project archive', archiveProj.ok, archiveProj.stderr)
assert('project archive sets archived=true', parse(archiveProj.stdout)?.archived === true)

const unarchiveProj = await cli('project', 'unarchive', projId, '--json')
assert('project unarchive', unarchiveProj.ok, unarchiveProj.stderr)
assert('project unarchive sets archived=false', parse(unarchiveProj.stdout)?.archived === false)

// ── task: human once ─────────────────────────────────────────────────────────
console.log('\n── task (human, once) ──')

const createHuman = await cli('task', 'create',
  '--title', 'Buy groceries',
  '--project', projId,
  '--assignee', 'human',
  '--kind', 'once',
  '--json',
)
assert('task create human', createHuman.ok, createHuman.stderr)
const humanTask = parse(createHuman.stdout)
assert('task create human returns id', humanTask?.id?.startsWith('task_'))
assert('task create human assignee', humanTask?.assignee === 'human')
assert('task create human status=pending', humanTask?.status === 'pending')
const humanTaskId = humanTask?.id

const getTask = await cli('task', 'get', humanTaskId, '--json')
assert('task get', getTask.ok, getTask.stderr)
assert('task get returns correct id', parse(getTask.stdout)?.id === humanTaskId)

const listTasks = await cli('task', 'list', '--project', projId, '--json')
assert('task list', listTasks.ok, listTasks.stderr)
const tasks = parse(listTasks.stdout)
assert('task list returns array', Array.isArray(tasks))
assert('task list contains created', tasks?.some((t: any) => t.id === humanTaskId))

const listHuman = await cli('task', 'list', '--assignee', 'human', '--json')
assert('task list --assignee human', listHuman.ok)
assert('task list filters by assignee', parse(listHuman.stdout)?.every((t: any) => t.assignee === 'human'))

const doneTask = await cli('task', 'done', humanTaskId, '--output', 'bought milk', '--json')
assert('task done', doneTask.ok, doneTask.stderr)
assert('task done status=done', parse(doneTask.stdout)?.status === 'done')
assert('task done completionOutput', parse(doneTask.stdout)?.completionOutput === 'bought milk')

// ── task: update ─────────────────────────────────────────────────────────────
console.log('\n── task update ──')

const createForUpdate = await cli('task', 'create',
  '--title', 'Task to update',
  '--project', projId,
  '--json',
)
const updateTaskId = parse(createForUpdate.stdout)?.id

const updateTask = await cli('task', 'update', updateTaskId,
  '--title', 'Updated title',
  '--description', 'new desc',
  '--json',
)
assert('task update', updateTask.ok, updateTask.stderr)
assert('task update title', parse(updateTask.stdout)?.title === 'Updated title')

const disableTask = await cli('task', 'update', updateTaskId, '--disable', '--json')
assert('task update --disable', disableTask.ok)
assert('task update enabled=false', parse(disableTask.stdout)?.enabled === false)

const enableTask = await cli('task', 'update', updateTaskId, '--enable', '--json')
assert('task update --enable', enableTask.ok)
assert('task update enabled=true', parse(enableTask.stdout)?.enabled === true)

// ── task: cancel ─────────────────────────────────────────────────────────────
console.log('\n── task cancel ──')

const createForCancel = await cli('task', 'create',
  '--title', 'Task to cancel',
  '--project', projId,
  '--json',
)
const cancelTaskId = parse(createForCancel.stdout)?.id
const cancelTask = await cli('task', 'cancel', cancelTaskId, '--json')
assert('task cancel', cancelTask.ok, cancelTask.stderr)
assert('task cancel status=cancelled', parse(cancelTask.stdout)?.status === 'cancelled')

// ── task: script executor ────────────────────────────────────────────────────
console.log('\n── task (ai, script executor) ──')

const createScript = await cli('task', 'create',
  '--title', 'Echo test',
  '--project', projId,
  '--assignee', 'ai',
  '--kind', 'once',
  '--executor-kind', 'script',
  '--script', 'echo "hello from conductor"',
  '--json',
)
assert('task create script', createScript.ok, createScript.stderr)
const scriptTask = parse(createScript.stdout)
assert('task create script executor_kind', scriptTask?.executor?.kind === 'script')
const scriptTaskId = scriptTask?.id

const runScript = await cli('task', 'run', scriptTaskId, '--json')
assert('task run (script)', runScript.ok, runScript.stderr)
const afterRun = parse(runScript.stdout)
assert('task run status=done', afterRun?.status === 'done', `status=${afterRun?.status}`)

// ── task: logs & ops ─────────────────────────────────────────────────────────
console.log('\n── task logs & ops ──')

const logs = await cli('task', 'logs', scriptTaskId, '--json')
assert('task logs', logs.ok, logs.stderr)
const logList = parse(logs.stdout)
assert('task logs returns array', Array.isArray(logList))
assert('task logs has entry', logList?.length > 0)
assert('task logs status=success', logList?.[0]?.status === 'success')

const ops = await cli('task', 'ops', scriptTaskId, '--json')
assert('task ops', ops.ok, ops.stderr)
const opList = parse(ops.stdout)
assert('task ops returns array', Array.isArray(opList))
assert('task ops has entries', opList?.length > 0)

// ── task: recurring ──────────────────────────────────────────────────────────
console.log('\n── task (recurring) ──')

const createRecurring = await cli('task', 'create',
  '--title', 'Daily report',
  '--project', projId,
  '--assignee', 'ai',
  '--kind', 'recurring',
  '--cron', '0 9 * * *',
  '--executor-kind', 'script',
  '--script', 'echo "daily"',
  '--json',
)
assert('task create recurring', createRecurring.ok, createRecurring.stderr)
const recurringTask = parse(createRecurring.stdout)
assert('task create recurring kind', recurringTask?.kind === 'recurring')
assert('task create recurring cron', recurringTask?.scheduleConfig?.cron === '0 9 * * *')

// ── task: scheduled ──────────────────────────────────────────────────────────
console.log('\n── task (scheduled) ──')

const futureDate = new Date(Date.now() + 86400000).toISOString()
const createScheduled = await cli('task', 'create',
  '--title', 'Scheduled task',
  '--project', projId,
  '--assignee', 'ai',
  '--kind', 'scheduled',
  '--scheduled-at', futureDate,
  '--executor-kind', 'script',
  '--script', 'echo "scheduled"',
  '--json',
)
assert('task create scheduled', createScheduled.ok, createScheduled.stderr)
const scheduledTask = parse(createScheduled.stdout)
assert('task create scheduled kind', scheduledTask?.kind === 'scheduled')
assert('task create scheduled scheduledAt', scheduledTask?.scheduleConfig?.scheduledAt === futureDate)

// ── task: list filters ───────────────────────────────────────────────────────
console.log('\n── task list filters ──')

const listByKind = await cli('task', 'list', '--kind', 'recurring', '--json')
assert('task list --kind recurring', listByKind.ok)
assert('task list kind filter works', parse(listByKind.stdout)?.every((t: any) => t.kind === 'recurring'))

const listByStatus = await cli('task', 'list', '--status', 'done', '--json')
assert('task list --status done', listByStatus.ok)
assert('task list status filter works', parse(listByStatus.stdout)?.every((t: any) => t.status === 'done'))

// ── prompt ───────────────────────────────────────────────────────────────────
console.log('\n── prompt ──')

const setDefault = await cli('prompt', 'set', 'You are a helpful assistant.')
assert('prompt set (system)', setDefault.ok, setDefault.stderr)

const getDefault = await cli('prompt', 'get', '--json')
assert('prompt get (system)', getDefault.ok, getDefault.stderr)
assert('prompt get content', parse(getDefault.stdout)?.content === 'You are a helpful assistant.')
assert('prompt get key=default', parse(getDefault.stdout)?.key === 'default')

const setProject = await cli('prompt', 'set', 'Project context.', '--project', projId)
assert('prompt set (project)', setProject.ok, setProject.stderr)

const getProject = await cli('prompt', 'get', '--project', projId, '--json')
assert('prompt get (project)', getProject.ok, getProject.stderr)
assert('prompt get project content', parse(getProject.stdout)?.content === 'Project context.')

const deleteProject = await cli('prompt', 'delete', '--project', projId, '--json')
assert('prompt delete (project)', deleteProject.ok, deleteProject.stderr)
assert('prompt delete ok=true', parse(deleteProject.stdout)?.ok === true)

const getDeletedProject = await cli('prompt', 'get', '--project', projId, '--json')
assert('prompt get after delete → error', !getDeletedProject.ok)

// ── task: delete ─────────────────────────────────────────────────────────────
console.log('\n── task delete ──')

const createForDelete = await cli('task', 'create',
  '--title', 'To delete',
  '--project', projId,
  '--json',
)
const deleteTaskId = parse(createForDelete.stdout)?.id
const deleteTask = await cli('task', 'delete', deleteTaskId, '--json')
assert('task delete', deleteTask.ok, deleteTask.stderr)
assert('task delete ok=true', parse(deleteTask.stdout)?.ok === true)

const getDeleted = await cli('task', 'get', deleteTaskId, '--json')
assert('task get after delete → error', !getDeleted.ok)

// ── project: delete ───────────────────────────────────────────────────────────
console.log('\n── project delete ──')

const deleteProj = await cli('project', 'delete', projId, '--json')
assert('project delete', deleteProj.ok, deleteProj.stderr)
assert('project delete ok=true', parse(deleteProj.stdout)?.ok === true)

// ── info ─────────────────────────────────────────────────────────────────────
console.log('\n── info ──')

const info = await cli('info', '--json')
assert('info', info.ok, info.stderr)
const infoData = parse(info.stdout)
assert('info has version', !!infoData?.version)
assert('info has port', infoData?.port === 7762)

// ─── summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`  passed: ${passed}`)
console.log(`  failed: ${failed}`)
console.log(`${'─'.repeat(40)}\n`)

if (failed > 0) process.exit(1)
