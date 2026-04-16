/**
 * Timeline grouping logic tests
 * Run with: bun packages/web/src/lib/timeline.test.ts
 */
import { groupTasksForTimeline, getTaskTimeDisplay } from './timeline'
import type { Task } from '@conductor/types'

let passed = 0
let failed = 0

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`)
    failed++
  }
}

function section(name: string) {
  console.log(`\n── ${name} ──`)
}

function makeTask(overrides: Partial<Task> & { id: string; title: string }): Task {
  return {
    projectId: 'proj_1',
    assignee: 'human',
    kind: 'once',
    status: 'pending',
    enabled: true,
    createdBy: 'human',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Task
}

// Today / tomorrow helpers
const today = new Date()
const tomorrow = new Date(today)
tomorrow.setDate(today.getDate() + 1)
const nextWeek = new Date(today)
nextWeek.setDate(today.getDate() + 7)

function isoDate(d: Date): string {
  return d.toISOString()
}

console.log('\n=== timeline grouping tests ===')

// ── empty tasks ───────────────────────────────────────────────────────────────
section('empty tasks')

{
  const groups = groupTasksForTimeline([])
  assert('empty tasks → empty groups', groups.length === 0)
}

// ── done/cancelled tasks go to done group ─────────────────────────────────────
section('done and cancelled tasks')

{
  const tasks = [
    makeTask({ id: 't1', title: 'Done task', status: 'done' }),
    makeTask({ id: 't2', title: 'Cancelled task', status: 'cancelled' }),
    makeTask({ id: 't3', title: 'Pending task', status: 'pending' }),
  ]
  const groups = groupTasksForTimeline(tasks)
  const doneGroup = groups.find(g => g.kind === 'done')
  const noTimeGroup = groups.find(g => g.kind === 'no_time')

  assert('done group exists', !!doneGroup)
  assert('done group has 2 tasks', doneGroup?.tasks.length === 2)
  assert('no_time group has 1 pending task', noTimeGroup?.tasks.length === 1)
}

// ── tasks with scheduled time go to date groups ───────────────────────────────
section('scheduled tasks → date groups')

{
  const tasks = [
    makeTask({
      id: 't1', title: 'Today task', assignee: 'ai', kind: 'scheduled',
      scheduleConfig: { kind: 'scheduled', scheduledAt: isoDate(today) },
    }),
    makeTask({
      id: 't2', title: 'Tomorrow task', assignee: 'ai', kind: 'scheduled',
      scheduleConfig: { kind: 'scheduled', scheduledAt: isoDate(tomorrow) },
    }),
  ]
  const groups = groupTasksForTimeline(tasks)
  const dateGroups = groups.filter(g => g.kind === 'date')

  assert('two date groups created', dateGroups.length === 2)
  assert('today group label is 今天', dateGroups[0].label === '今天')
  assert('tomorrow group label is 明天', dateGroups[1].label === '明天')
}

// ── recurring tasks go to recurring group ─────────────────────────────────────
section('recurring tasks → recurring group')

{
  const tasks = [
    makeTask({
      id: 't1', title: 'Daily task', assignee: 'ai', kind: 'recurring',
      scheduleConfig: { kind: 'recurring', cron: '0 9 * * *', nextRunAt: isoDate(tomorrow) },
    }),
    makeTask({
      id: 't2', title: 'Weekly task', assignee: 'ai', kind: 'recurring',
      scheduleConfig: { kind: 'recurring', cron: '0 9 * * 1', nextRunAt: isoDate(nextWeek) },
    }),
  ]
  const groups = groupTasksForTimeline(tasks)
  const recurringGroup = groups.find(g => g.kind === 'recurring')

  assert('recurring group exists', !!recurringGroup)
  assert('recurring group has 2 tasks', recurringGroup?.tasks.length === 2)
  assert('no date groups for recurring', !groups.some(g => g.kind === 'date'))
}

// ── no-time tasks go to no_time group ────────────────────────────────────────
section('no-time tasks → no_time group')

{
  const tasks = [
    makeTask({ id: 't1', title: 'No time task 1' }),
    makeTask({ id: 't2', title: 'No time task 2' }),
  ]
  const groups = groupTasksForTimeline(tasks)
  const noTimeGroup = groups.find(g => g.kind === 'no_time')

  assert('no_time group exists', !!noTimeGroup)
  assert('no_time group has 2 tasks', noTimeGroup?.tasks.length === 2)
}

// ── assignee filter ───────────────────────────────────────────────────────────
section('assignee filter')

{
  const tasks = [
    makeTask({ id: 't1', title: 'Human task', assignee: 'human' }),
    makeTask({ id: 't2', title: 'AI task', assignee: 'ai' }),
  ]

  const humanGroups = groupTasksForTimeline(tasks, 'human')
  const humanTasks = humanGroups.flatMap(g => g.tasks)
  assert('human filter: only human tasks', humanTasks.every(t => t.assignee === 'human'))
  assert('human filter: 1 task', humanTasks.length === 1)

  const aiGroups = groupTasksForTimeline(tasks, 'ai')
  const aiTasks = aiGroups.flatMap(g => g.tasks)
  assert('ai filter: only ai tasks', aiTasks.every(t => t.assignee === 'ai'))
  assert('ai filter: 1 task', aiTasks.length === 1)
}

// ── group ordering ────────────────────────────────────────────────────────────
section('group ordering')

{
  const tasks = [
    makeTask({ id: 't1', title: 'No time task' }),
    makeTask({
      id: 't2', title: 'Today task', assignee: 'ai', kind: 'scheduled',
      scheduleConfig: { kind: 'scheduled', scheduledAt: isoDate(today) },
    }),
    makeTask({
      id: 't3', title: 'Recurring', assignee: 'ai', kind: 'recurring',
      scheduleConfig: { kind: 'recurring', cron: '0 9 * * *' },
    }),
    makeTask({ id: 't4', title: 'Done task', status: 'done' }),
  ]

  const groups = groupTasksForTimeline(tasks)
  const kinds = groups.map(g => g.kind)

  assert('date groups come before recurring', kinds.indexOf('date') < kinds.indexOf('recurring'))
  assert('recurring comes before no_time', kinds.indexOf('recurring') < kinds.indexOf('no_time'))
  assert('no_time comes before done', kinds.indexOf('no_time') < kinds.indexOf('done'))
}

// ── date group ordering (chronological) ──────────────────────────────────────
section('date groups are chronological')

{
  const tasks = [
    makeTask({
      id: 't1', title: 'Next week', assignee: 'ai', kind: 'scheduled',
      scheduleConfig: { kind: 'scheduled', scheduledAt: isoDate(nextWeek) },
    }),
    makeTask({
      id: 't2', title: 'Tomorrow', assignee: 'ai', kind: 'scheduled',
      scheduleConfig: { kind: 'scheduled', scheduledAt: isoDate(tomorrow) },
    }),
    makeTask({
      id: 't3', title: 'Today', assignee: 'ai', kind: 'scheduled',
      scheduleConfig: { kind: 'scheduled', scheduledAt: isoDate(today) },
    }),
  ]

  const groups = groupTasksForTimeline(tasks)
  const dateGroups = groups.filter(g => g.kind === 'date')

  assert('first date group is today', dateGroups[0]?.label === '今天')
  assert('second date group is tomorrow', dateGroups[1]?.label === '明天')
  assert('three date groups', dateGroups.length === 3)
}

// ── getTaskTimeDisplay ────────────────────────────────────────────────────────
section('getTaskTimeDisplay')

{
  const task = makeTask({
    id: 't1', title: 'No time',
  })
  assert('no scheduleConfig → null', getTaskTimeDisplay(task) === null)
}

{
  const d = new Date('2026-04-15T09:00:00.000Z')
  const task = makeTask({
    id: 't1', title: 'Scheduled',
    assignee: 'ai', kind: 'scheduled',
    scheduleConfig: { kind: 'scheduled', scheduledAt: d.toISOString() },
  })
  const display = getTaskTimeDisplay(task)
  assert('scheduled task has time display', display !== null)
  assert('time display is a string', typeof display === 'string')
}

{
  const d = new Date('2026-04-15T09:00:00.000Z')
  const task = makeTask({
    id: 't1', title: 'Recurring',
    assignee: 'ai', kind: 'recurring',
    scheduleConfig: { kind: 'recurring', cron: '0 9 * * *', nextRunAt: d.toISOString() },
  })
  const display = getTaskTimeDisplay(task)
  assert('recurring with nextRunAt has time display', display !== null)
}

{
  const task = makeTask({
    id: 't1', title: 'Recurring no nextRunAt',
    assignee: 'ai', kind: 'recurring',
    scheduleConfig: { kind: 'recurring', cron: '0 9 * * *' },
  })
  assert('recurring without nextRunAt → null', getTaskTimeDisplay(task) === null)
}

// ── blocked tasks not in inlined set ─────────────────────────────────────────
section('blocked AI task with human task')

{
  const blockedAi = makeTask({
    id: 'ai_1', title: 'Blocked AI task', assignee: 'ai', status: 'blocked',
    blockedByTaskId: 'human_1',
  })
  const humanBlocker = makeTask({
    id: 'human_1', title: 'Human approval', assignee: 'human', status: 'pending',
    sourceTaskId: 'ai_1',
  })

  const groups = groupTasksForTimeline([blockedAi, humanBlocker])
  const allTasks = groups.flatMap(g => g.tasks)

  // Both tasks should appear in groups (inlining is done in Timeline component, not groupTasksForTimeline)
  assert('blocked AI task in groups', allTasks.some(t => t.id === 'ai_1'))
  assert('human blocker task in groups', allTasks.some(t => t.id === 'human_1'))
}

// ── summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(44)}`)
console.log(`  passed: ${passed}`)
console.log(`  failed: ${failed}`)
console.log(`${'─'.repeat(44)}\n`)
if (failed > 0) process.exit(1)
