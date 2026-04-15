/**
 * Unit tests for model layer (direct DB operations, no HTTP/CLI)
 */
import { cleanTestDb, assert, section, summary } from './helpers'

// Must set env before importing models
process.env.CONDUCTOR_TEST_DB = `${process.env.HOME}/.conductor/test-models.sqlite`
cleanTestDb()

import { initDb, resetDb } from '../src/db/init'
import {
  createProject, getProject, listProjects, updateProject,
  archiveProject, unarchiveProject, deleteProject,
} from '../src/models/projects'
import {
  createGroup, getGroup, listGroups, updateGroup, deleteGroup,
  reorderGroups, reorderProjectsInGroup, getProjectsView,
} from '../src/models/project-groups'
import {
  createTask, getTask, listTasks, updateTask, deleteTask,
  getBlockedByTask, getDependentTasks, reconcileRunningTasks,
} from '../src/models/tasks'
import { createTaskLog, getTaskLogs, updateTaskLogCompleted } from '../src/models/task-logs'
import { createTaskOp, getTaskOps } from '../src/models/task-ops'
import { getSystemPrompt, setSystemPrompt, deleteSystemPrompt } from '../src/models/system-prompts'

console.log('\n=== model unit tests ===')

initDb()

// ── projects ──────────────────────────────────────────────────────────────────
section('projects')

const p1 = createProject({ name: 'Project Alpha', goal: 'test', workDir: '/tmp' })
assert('createProject returns id', p1.id.startsWith('proj_'))
assert('createProject name', p1.name === 'Project Alpha')
assert('createProject goal', p1.goal === 'test')
assert('createProject workDir', p1.workDir === '/tmp')
assert('createProject archived=false', p1.archived === false)

const fetched = getProject(p1.id)
assert('getProject', fetched?.id === p1.id)
assert('getProject null for missing', getProject('proj_missing') === null)

const p2 = createProject({ name: 'Project Beta' })
const all = listProjects()
assert('listProjects returns both', all.length >= 2)
assert('listProjects contains p1', all.some(p => p.id === p1.id))

const updated = updateProject(p1.id, { name: 'Project Alpha Updated', goal: 'new goal' })
assert('updateProject name', updated?.name === 'Project Alpha Updated')
assert('updateProject goal', updated?.goal === 'new goal')
assert('updateProject returns null for missing', updateProject('proj_x', { name: 'x' }) === null)

const archived = archiveProject(p1.id)
assert('archiveProject archived=true', archived?.archived === true)
assert('archiveProject archivedAt set', !!archived?.archivedAt)

const unarchived = unarchiveProject(p1.id)
assert('unarchiveProject archived=false', unarchived?.archived === false)
assert('unarchiveProject archivedAt cleared', !unarchived?.archivedAt)

// ── project_groups ────────────────────────────────────────────────────────────
section('project_groups')

const g1 = createGroup({ name: 'Work', createdBy: 'human' })
assert('createGroup returns id', g1.id.startsWith('group_'))
assert('createGroup name', g1.name === 'Work')
assert('createGroup collapsed=false by default', g1.collapsed === false)
assert('createGroup order=0 for first', g1.order === 0)

const g2 = createGroup({ name: 'Personal', collapsed: true, createdBy: 'ai' })
assert('createGroup collapsed=true', g2.collapsed === true)
assert('createGroup order increments', g2.order === 1)
assert('createGroup createdBy ai', g2.createdBy === 'ai')

assert('getGroup', getGroup(g1.id)?.id === g1.id)
assert('getGroup null for missing', getGroup('group_missing') === null)

const groups = listGroups()
assert('listGroups returns both', groups.length >= 2)

const updatedG = updateGroup(g1.id, { name: 'Work Updated', collapsed: true })
assert('updateGroup name', updatedG?.name === 'Work Updated')
assert('updateGroup collapsed', updatedG?.collapsed === true)
assert('updateGroup null for missing', updateGroup('group_x', { name: 'x' }) === null)

// assign projects to groups
const pGrouped1 = createProject({ name: 'Grouped Project 1', groupId: g1.id })
const pGrouped2 = createProject({ name: 'Grouped Project 2', groupId: g1.id })
assert('createProject with groupId', pGrouped1.groupId === g1.id)
assert('createProject order in group starts at 0', pGrouped1.order === 0)
assert('createProject order in group increments', pGrouped2.order === 1)

// pinned field
const pUnpinned = createProject({ name: 'Unpinned Project', pinned: false })
assert('createProject pinned=false', pUnpinned.pinned === false)
const pPinned = createProject({ name: 'Pinned Project' })
assert('createProject pinned=true by default', pPinned.pinned === true)

// updateProject groupId + pinned
const pMoved = updateProject(pGrouped1.id, { groupId: g2.id, pinned: false })
assert('updateProject groupId', pMoved?.groupId === g2.id)
assert('updateProject pinned=false', pMoved?.pinned === false)
const pUngrouped = updateProject(pGrouped2.id, { groupId: null })
assert('updateProject groupId=null (ungrouped)', pUngrouped?.groupId === undefined)

// reorderGroups
reorderGroups([g2.id, g1.id])
const reorderedGroups = listGroups()
assert('reorderGroups g2 first', reorderedGroups[0].id === g2.id)
assert('reorderGroups g1 second', reorderedGroups[1].id === g1.id)

// getProjectsView
const view = getProjectsView()
assert('getProjectsView has groups array', Array.isArray(view.groups))
assert('getProjectsView has ungrouped array', Array.isArray(view.ungrouped))
const viewGroup = view.groups.find(g => g.id === g1.id)
assert('getProjectsView group has projects array', Array.isArray(viewGroup?.projects))

// deleteGroup moves projects to ungrouped
const gTemp = createGroup({ name: 'Temp Group' })
const pInTemp = createProject({ name: 'Project in temp', groupId: gTemp.id })
assert('project in temp group', pInTemp.groupId === gTemp.id)
deleteGroup(gTemp.id)
const pAfterDelete = getProject(pInTemp.id)
assert('deleteGroup moves projects to ungrouped', !pAfterDelete?.groupId)
assert('deleteGroup removes group', getGroup(gTemp.id) === null)

// ── tasks ─────────────────────────────────────────────────────────────────────
section('tasks')

const t1 = createTask({
  projectId: p1.id,
  title: 'Human task',
  assignee: 'human',
  kind: 'once',
})
assert('createTask returns id', t1.id.startsWith('task_'))
assert('createTask status=pending', t1.status === 'pending')
assert('createTask assignee', t1.assignee === 'human')
assert('createTask enabled=true', t1.enabled === true)

const t2 = createTask({
  projectId: p1.id,
  title: 'AI script task',
  assignee: 'ai',
  kind: 'once',
  executor: { kind: 'script', command: 'echo hello' },
  executorOptions: { reviewOnComplete: true },
})
assert('createTask with executor', t2.executor?.kind === 'script')
assert('createTask executorOptions', t2.executorOptions?.reviewOnComplete === true)

const t3 = createTask({
  projectId: p1.id,
  title: 'Recurring task',
  assignee: 'ai',
  kind: 'recurring',
  scheduleConfig: { kind: 'recurring', cron: '0 9 * * *' },
  executor: { kind: 'script', command: 'echo daily' },
})
assert('createTask recurring scheduleConfig', t3.scheduleConfig?.kind === 'recurring')

assert('getTask', getTask(t1.id)?.id === t1.id)
assert('getTask null for missing', getTask('task_missing') === null)

const allTasks = listTasks({ projectId: p1.id })
assert('listTasks by projectId', allTasks.length >= 3)

const humanTasks = listTasks({ assignee: 'human' })
assert('listTasks filter assignee', humanTasks.every(t => t.assignee === 'human'))

const aiTasks = listTasks({ assignee: 'ai' })
assert('listTasks filter ai', aiTasks.every(t => t.assignee === 'ai'))

const recurringTasks = listTasks({ kind: 'recurring' })
assert('listTasks filter kind', recurringTasks.every(t => t.kind === 'recurring'))

// updateTask
const upd = updateTask(t1.id, { status: 'done', completionOutput: 'finished' })
assert('updateTask status', upd?.status === 'done')
assert('updateTask completionOutput', upd?.completionOutput === 'finished')
assert('updateTask null for missing', updateTask('task_x', { status: 'done' }) === null)

// blocked/unblock
const tBlocked = createTask({ projectId: p1.id, title: 'Blocked', assignee: 'ai', kind: 'once' })
const tBlocker = createTask({ projectId: p1.id, title: 'Blocker', assignee: 'human', kind: 'once' })
updateTask(tBlocked.id, { status: 'blocked', blockedByTaskId: tBlocker.id })
const blockedList = getBlockedByTask(tBlocker.id)
assert('getBlockedByTask', blockedList.length === 1 && blockedList[0].id === tBlocked.id)

// dependsOn
const tDep = createTask({ projectId: p1.id, title: 'Dependent', assignee: 'ai', kind: 'once', dependsOn: t2.id })
const deps = getDependentTasks(t2.id)
assert('getDependentTasks', deps.some(t => t.id === tDep.id))

// reconcile
const tRunning = createTask({ projectId: p1.id, title: 'Was running', assignee: 'ai', kind: 'once' })
updateTask(tRunning.id, { status: 'running' })
const stale = reconcileRunningTasks()
assert('reconcileRunningTasks finds running', stale.some(t => t.id === tRunning.id))
assert('reconcileRunningTasks resets to pending', getTask(tRunning.id)?.status === 'pending')

// deleteTask
assert('deleteTask', deleteTask(tDep.id) === true)
assert('deleteTask missing', deleteTask('task_x') === false)
assert('getTask after delete', getTask(tDep.id) === null)

// ── task_logs ─────────────────────────────────────────────────────────────────
section('task_logs')

const log1 = createTaskLog({
  taskId: t2.id,
  status: 'success',
  triggeredBy: 'cli',
  output: 'hello world',
})
assert('createTaskLog returns id', log1.id.startsWith('log_'))
assert('createTaskLog status', log1.status === 'success')
assert('createTaskLog output', log1.output === 'hello world')

const log2 = createTaskLog({ taskId: t2.id, status: 'skipped', triggeredBy: 'scheduler', skipReason: 'disabled' })
assert('createTaskLog skipped', log2.status === 'skipped')
assert('createTaskLog skipReason', log2.skipReason === 'disabled')

updateTaskLogCompleted(log1.id, 'failed', 'new output', 'something went wrong')
const logs = getTaskLogs(t2.id)
assert('getTaskLogs returns array', Array.isArray(logs))
assert('getTaskLogs has entries', logs.length >= 2)
assert('getTaskLogs ordered by started_at desc', logs[0].startedAt >= logs[1]?.startedAt)

// 64KB truncation
const bigOutput = 'x'.repeat(70 * 1024)
const logBig = createTaskLog({ taskId: t2.id, status: 'success', triggeredBy: 'cli', output: bigOutput })
assert('createTaskLog truncates output', (logBig.output?.length ?? 0) <= 65600)

// retention: only 200 logs per task
const tMany = createTask({ projectId: p1.id, title: 'Many logs', assignee: 'ai', kind: 'once' })
for (let i = 0; i < 205; i++) {
  createTaskLog({ taskId: tMany.id, status: 'success', triggeredBy: 'scheduler' })
}
const manyLogs = getTaskLogs(tMany.id, 300)
assert('createTaskLog retention max 200', manyLogs.length <= 200)

// ── task_ops ──────────────────────────────────────────────────────────────────
section('task_ops')

const op1 = createTaskOp({ taskId: t1.id, op: 'created', actor: 'human' })
assert('createTaskOp returns id', op1.id.startsWith('op_'))
assert('createTaskOp op', op1.op === 'created')
assert('createTaskOp actor', op1.actor === 'human')

const op2 = createTaskOp({
  taskId: t1.id,
  op: 'status_changed',
  fromStatus: 'pending',
  toStatus: 'done',
  actor: 'scheduler',
  note: 'completed successfully',
})
assert('createTaskOp with status fields', op2.fromStatus === 'pending' && op2.toStatus === 'done')
assert('createTaskOp note', op2.note === 'completed successfully')

const ops = getTaskOps(t1.id)
assert('getTaskOps returns array', Array.isArray(ops))
assert('getTaskOps has entries', ops.length >= 2)

// ops survive task deletion
const tForDel = createTask({ projectId: p1.id, title: 'To delete', assignee: 'human', kind: 'once' })
createTaskOp({ taskId: tForDel.id, op: 'created', actor: 'human' })
deleteTask(tForDel.id)
const opsAfterDelete = getTaskOps(tForDel.id)
assert('task_ops survive task deletion', opsAfterDelete.length >= 1)

// ── system_prompts ────────────────────────────────────────────────────────────
section('system_prompts')

const sp = setSystemPrompt('default', 'You are a helpful assistant.')
assert('setSystemPrompt', sp.key === 'default')
assert('setSystemPrompt content', sp.content === 'You are a helpful assistant.')

const got = getSystemPrompt('default')
assert('getSystemPrompt', got?.content === 'You are a helpful assistant.')
assert('getSystemPrompt null for missing', getSystemPrompt('proj_missing') === null)

// upsert
const sp2 = setSystemPrompt('default', 'Updated prompt.')
assert('setSystemPrompt upsert', sp2.content === 'Updated prompt.')

const projPrompt = setSystemPrompt('proj_test123', 'Project specific prompt.')
assert('setSystemPrompt project key', projPrompt.key === 'proj_test123')

assert('deleteSystemPrompt', deleteSystemPrompt('proj_test123') === true)
assert('deleteSystemPrompt missing', deleteSystemPrompt('proj_missing') === false)
assert('getSystemPrompt after delete', getSystemPrompt('proj_test123') === null)

// ── deleteProject cascade ─────────────────────────────────────────────────────
section('project delete cascade')

const pDel = createProject({ name: 'To delete' })
createTask({ projectId: pDel.id, title: 'Child task', assignee: 'human', kind: 'once' })
setSystemPrompt(`proj_${pDel.id}`, 'project prompt')
assert('deleteProject with tasks', deleteProject(pDel.id) === true)
assert('project gone after delete', getProject(pDel.id) === null)
assert('project prompt gone after delete', getSystemPrompt(`proj_${pDel.id}`) === null)

// cleanup
resetDb()
cleanTestDb()

summary()
