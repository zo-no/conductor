/**
 * HTTP API integration tests
 * Starts a test server on port 7763 with an isolated test DB
 */
import { unlinkSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { assert, section, summary, api } from './helpers'

const TEST_DB = join(homedir(), '.conductor', 'test-http.sqlite')
process.env.CONDUCTOR_TEST_DB = TEST_DB
process.env.CONDUCTOR_PORT = '7763'

try { unlinkSync(TEST_DB) } catch {}

// Boot the server inline (don't import server.ts which uses Bun.serve via export default)
const { initDb } = await import('../src/db/init')
const { reconcile, startScheduler } = await import('../src/services/scheduler')
const projectsRouter = (await import('../src/controllers/http/projects')).default
const groupsModule = await import('../src/controllers/http/groups')
const groupsRouter = groupsModule.default
const viewProjectsRouter = groupsModule.viewProjectsRouter
const ungroupedReorderRouter = groupsModule.ungroupedReorderRouter
const tasksRouter = (await import('../src/controllers/http/tasks')).default
const promptsRouter = (await import('../src/controllers/http/prompts')).default
const { Hono } = await import('hono')

initDb()
reconcile()
startScheduler()

const app = new Hono()
app.route('/api/projects', projectsRouter)
app.route('/api/groups', groupsRouter)
app.route('/api/view/projects', viewProjectsRouter)
app.route('/api/ungrouped/reorder', ungroupedReorderRouter)
app.route('/api/tasks', tasksRouter)
app.route('/api/prompts', promptsRouter)
app.get('/health', (c) => c.json({ ok: true, pid: process.pid }))

const server = Bun.serve({ port: 7763, fetch: app.fetch })
await Bun.sleep(300)

console.log('\n=== HTTP API tests ===')

// ── health ────────────────────────────────────────────────────────────────────
section('health')

const health = await api('GET', '/health')
assert('GET /health ok', health.ok)
assert('GET /health has pid', typeof health.data?.pid === 'number')

// ── projects ──────────────────────────────────────────────────────────────────
section('projects')

let projId: string

{
  const r = await api('POST', '/api/projects', { name: 'Test Project', goal: 'API test', workDir: '/tmp' })
  assert('POST /api/projects 201', r.status === 201)
  assert('POST /api/projects returns id', r.data?.id?.startsWith('proj_'))
  assert('POST /api/projects name', r.data?.name === 'Test Project')
  projId = r.data?.id
}

{
  const r = await api('POST', '/api/projects', {})
  assert('POST /api/projects missing name → 400', r.status === 400)
}

{
  const r = await api('GET', '/api/projects')
  assert('GET /api/projects 200', r.ok)
  assert('GET /api/projects returns array', Array.isArray(r.data))
  assert('GET /api/projects contains created', r.data?.some((p: any) => p.id === projId))
}

{
  const r = await api('GET', `/api/projects/${projId}`)
  assert('GET /api/projects/:id 200', r.ok)
  assert('GET /api/projects/:id correct id', r.data?.id === projId)
}

{
  const r = await api('GET', '/api/projects/proj_missing')
  assert('GET /api/projects/:id not found → 404', r.status === 404)
}

{
  const r = await api('PATCH', `/api/projects/${projId}`, { name: 'Updated Project' })
  assert('PATCH /api/projects/:id 200', r.ok)
  assert('PATCH /api/projects/:id name updated', r.data?.name === 'Updated Project')
}

{
  const r = await api('POST', `/api/projects/${projId}/archive`)
  assert('POST /api/projects/:id/archive', r.ok)
  assert('archive sets archived=true', r.data?.archived === true)
}

{
  const r = await api('POST', `/api/projects/${projId}/unarchive`)
  assert('POST /api/projects/:id/unarchive', r.ok)
  assert('unarchive sets archived=false', r.data?.archived === false)
}

// ── groups ────────────────────────────────────────────────────────────────────
section('groups')

let groupId: string
{
  const r = await api('POST', '/api/groups', { name: 'Work', collapsed: false })
  assert('POST /api/groups 201', r.ok)
  assert('POST /api/groups returns id', r.data?.id?.startsWith('group_'))
  assert('POST /api/groups name', r.data?.name === 'Work')
  assert('POST /api/groups collapsed=false', r.data?.collapsed === false)
  groupId = r.data.id
}

{
  const r = await api('GET', '/api/groups')
  assert('GET /api/groups returns array', Array.isArray(r.data))
  assert('GET /api/groups contains created group', r.data?.some((g: any) => g.id === groupId))
  assert('GET /api/groups group has projects array', Array.isArray(r.data?.find((g: any) => g.id === groupId)?.projects))
}

{
  const r = await api('GET', `/api/groups/${groupId}`)
  assert('GET /api/groups/:id 200', r.ok)
  assert('GET /api/groups/:id returns group', r.data?.id === groupId)
}

{
  const r = await api('PATCH', `/api/groups/${groupId}`, { name: 'Work Updated', collapsed: true })
  assert('PATCH /api/groups/:id name', r.data?.name === 'Work Updated')
  assert('PATCH /api/groups/:id collapsed', r.data?.collapsed === true)
}

// assign project to group
{
  const r = await api('PATCH', `/api/projects/${projId}`, { groupId, pinned: false })
  assert('PATCH /api/projects/:id groupId', r.data?.groupId === groupId)
  assert('PATCH /api/projects/:id pinned=false', r.data?.pinned === false)
}

// view/projects
{
  const r = await api('GET', '/api/view/projects')
  assert('GET /api/view/projects ok', r.ok)
  assert('GET /api/view/projects has groups', Array.isArray(r.data?.groups))
  assert('GET /api/view/projects has ungrouped', Array.isArray(r.data?.ungrouped))
  const g = r.data?.groups?.find((g: any) => g.id === groupId)
  assert('GET /api/view/projects group has project', g?.projects?.some((p: any) => p.id === projId))
}

// second group for reorder test
let groupId2: string
{
  const r = await api('POST', '/api/groups', { name: 'Personal' })
  groupId2 = r.data.id
}

{
  const r = await api('POST', '/api/groups/reorder', { ids: [groupId2, groupId] })
  assert('POST /api/groups/reorder ok', r.data?.ok === true)
  const listR = await api('GET', '/api/groups')
  assert('reorder groups: groupId2 first', listR.data?.[0]?.id === groupId2)
}

// reorder projects within group
{
  const p2r = await api('POST', '/api/projects', { name: 'Second project in group', groupId })
  const pid2 = p2r.data.id
  const r = await api('POST', `/api/groups/${groupId}/projects/reorder`, { ids: [pid2, projId] })
  assert('POST /api/groups/:id/projects/reorder ok', r.data?.ok === true)
}

// delete group → projects move to ungrouped
{
  const gDel = await api('POST', '/api/groups', { name: 'To Delete' })
  const gDelId = gDel.data.id
  const pDel = await api('POST', '/api/projects', { name: 'In deleted group', groupId: gDelId })
  const pDelId = pDel.data.id
  const r = await api('DELETE', `/api/groups/${gDelId}`)
  assert('DELETE /api/groups/:id ok', r.data?.ok === true)
  const pAfter = await api('GET', `/api/projects/${pDelId}`)
  assert('DELETE group: project groupId=null', !pAfter.data?.groupId)
}

// ── tasks ─────────────────────────────────────────────────────────────────────
section('tasks - human')

let humanTaskId: string

{
  const r = await api('POST', '/api/tasks', {
    projectId: projId,
    title: 'Human task',
    assignee: 'human',
    kind: 'once',
  })
  assert('POST /api/tasks human 201', r.status === 201)
  assert('POST /api/tasks returns id', r.data?.id?.startsWith('task_'))
  assert('POST /api/tasks status=pending', r.data?.status === 'pending')
  humanTaskId = r.data?.id
}

{
  const r = await api('POST', '/api/tasks', { title: 'no project' })
  assert('POST /api/tasks missing projectId → 400', r.status === 400)
}

{
  const r = await api('GET', '/api/tasks')
  assert('GET /api/tasks 200', r.ok)
  assert('GET /api/tasks returns array', Array.isArray(r.data))
}

{
  const r = await api('GET', `/api/tasks?projectId=${projId}`)
  assert('GET /api/tasks?projectId filter', r.data?.some((t: any) => t.id === humanTaskId))
}

{
  const r = await api('GET', `/api/tasks?assignee=human`)
  assert('GET /api/tasks?assignee=human filter', r.data?.every((t: any) => t.assignee === 'human'))
}

{
  const r = await api('GET', `/api/tasks/${humanTaskId}`)
  assert('GET /api/tasks/:id 200', r.ok)
  assert('GET /api/tasks/:id correct id', r.data?.id === humanTaskId)
}

{
  const r = await api('GET', '/api/tasks/task_missing')
  assert('GET /api/tasks/:id not found → 404', r.status === 404)
}

{
  const r = await api('PATCH', `/api/tasks/${humanTaskId}`, { title: 'Updated human task' })
  assert('PATCH /api/tasks/:id 200', r.ok)
  assert('PATCH /api/tasks/:id title updated', r.data?.title === 'Updated human task')
}

{
  const r = await api('POST', `/api/tasks/${humanTaskId}/done`, { output: 'completed!' })
  assert('POST /api/tasks/:id/done 200', r.ok)
  assert('done status=done', r.data?.status === 'done')
  assert('done completionOutput', r.data?.completionOutput === 'completed!')
}

{
  // create a fresh task to cancel
  const created = await api('POST', '/api/tasks', { projectId: projId, title: 'To cancel', assignee: 'human', kind: 'once' })
  const r = await api('POST', `/api/tasks/${created.data?.id}/cancel`)
  assert('POST /api/tasks/:id/cancel 200', r.ok)
  assert('cancel status=cancelled', r.data?.status === 'cancelled')
}

// ── tasks - ai with script executor ──────────────────────────────────────────
section('tasks - ai script executor')

let scriptTaskId: string

{
  const r = await api('POST', '/api/tasks', {
    projectId: projId,
    title: 'Script task',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'echo "api test output"' },
  })
  assert('POST /api/tasks ai script 201', r.status === 201)
  assert('executor kind stored', r.data?.executor?.kind === 'script')
  scriptTaskId = r.data?.id
}

{
  const r = await api('POST', `/api/tasks/${scriptTaskId}/run`)
  assert('POST /api/tasks/:id/run 200', r.ok)
  assert('run returns taskId', r.data?.taskId === scriptTaskId)
  // Give executor time to finish
  await Bun.sleep(2000)
  const check = await api('GET', `/api/tasks/${scriptTaskId}`)
  assert('task status=done after run', check.data?.status === 'done')
}

{
  const r = await api('GET', `/api/tasks/${scriptTaskId}/logs`)
  assert('GET /api/tasks/:id/logs 200', r.ok)
  assert('logs returns array', Array.isArray(r.data))
  assert('logs has entry', r.data?.length > 0)
  assert('log status=success', r.data?.[0]?.status === 'success')
  assert('log has output', r.data?.[0]?.output?.includes('api test output'))
}

{
  const r = await api('GET', `/api/tasks/${scriptTaskId}/ops`)
  assert('GET /api/tasks/:id/ops 200', r.ok)
  assert('ops returns array', Array.isArray(r.data))
  assert('ops has entries', r.data?.length > 0)
}

// ── tasks - recurring ─────────────────────────────────────────────────────────
section('tasks - recurring & scheduled')

{
  const r = await api('POST', '/api/tasks', {
    projectId: projId,
    title: 'Daily report',
    assignee: 'ai',
    kind: 'recurring',
    scheduleConfig: { kind: 'recurring', cron: '0 9 * * *' },
    executor: { kind: 'script', command: 'echo daily' },
  })
  assert('POST recurring task', r.status === 201)
  assert('recurring scheduleConfig stored', r.data?.scheduleConfig?.kind === 'recurring')
  assert('recurring cron stored', r.data?.scheduleConfig?.cron === '0 9 * * *')
}

{
  const futureDate = new Date(Date.now() + 86400000).toISOString()
  const r = await api('POST', '/api/tasks', {
    projectId: projId,
    title: 'Scheduled task',
    assignee: 'ai',
    kind: 'scheduled',
    scheduleConfig: { kind: 'scheduled', scheduledAt: futureDate },
    executor: { kind: 'script', command: 'echo scheduled' },
  })
  assert('POST scheduled task', r.status === 201)
  assert('scheduled scheduledAt stored', r.data?.scheduleConfig?.scheduledAt === futureDate)
}

// ── tasks - http executor ─────────────────────────────────────────────────────
section('tasks - http executor')

{
  const r = await api('POST', '/api/tasks', {
    projectId: projId,
    title: 'HTTP task',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'http', url: 'https://httpbin.org/get', method: 'GET' },
  })
  assert('POST http executor task', r.status === 201)
  assert('http executor kind stored', r.data?.executor?.kind === 'http')
}

// ── tasks - human-in-the-loop (blocked/unblock) ───────────────────────────────
section('tasks - human-in-the-loop')

{
  // Create AI task that will be blocked
  const aiTask = await api('POST', '/api/tasks', {
    projectId: projId,
    title: 'AI task waiting for human',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'echo resumed' },
  })
  const aiId = aiTask.data?.id

  // Create human task that blocks the AI task
  const humanTask = await api('POST', '/api/tasks', {
    projectId: projId,
    title: 'Human approval needed',
    assignee: 'human',
    kind: 'once',
    waitingInstructions: 'Please approve and mark done',
  })
  const humanId = humanTask.data?.id

  // Block the AI task
  await api('PATCH', `/api/tasks/${aiId}`, { status: 'blocked', blockedByTaskId: humanId })
  const blocked = await api('GET', `/api/tasks/${aiId}`)
  assert('AI task is blocked', blocked.data?.status === 'blocked')

  // Human marks done → AI task should unblock and run
  await api('POST', `/api/tasks/${humanId}/done`, { output: 'approved' })
  await Bun.sleep(2000)

  const aiAfter = await api('GET', `/api/tasks/${aiId}`)
  assert('AI task unblocked after human done', aiAfter.data?.status === 'done')
  assert('AI task has completionOutput from human', aiAfter.data?.completionOutput === 'approved')
}

// ── prompts ───────────────────────────────────────────────────────────────────
section('prompts')

{
  const r = await api('PATCH', '/api/prompts/system', { content: 'System prompt content.' })
  assert('PATCH /api/prompts/system 200', r.ok)
  assert('system prompt content stored', r.data?.content === 'System prompt content.')
}

{
  const r = await api('GET', '/api/prompts/system')
  assert('GET /api/prompts/system 200', r.ok)
  assert('GET system prompt content', r.data?.content === 'System prompt content.')
}

{
  const r = await api('PATCH', `/api/prompts/project/${projId}`, { content: 'Project prompt.' })
  assert('PATCH /api/prompts/project/:id 200', r.ok)
  assert('project prompt stored', r.data?.content === 'Project prompt.')
}

{
  const r = await api('GET', `/api/prompts/project/${projId}`)
  assert('GET /api/prompts/project/:id 200', r.ok)
  assert('GET project prompt content', r.data?.content === 'Project prompt.')
}

{
  const r = await api('DELETE', `/api/prompts/project/${projId}`)
  assert('DELETE /api/prompts/project/:id 200', r.ok)
}

{
  const r = await api('GET', `/api/prompts/project/${projId}`)
  assert('GET project prompt after delete → 404', r.status === 404)
}

// ── tasks - delete ────────────────────────────────────────────────────────────
section('tasks - delete')

{
  const created = await api('POST', '/api/tasks', { projectId: projId, title: 'To delete', assignee: 'human', kind: 'once' })
  const id = created.data?.id
  const r = await api('DELETE', `/api/tasks/${id}`)
  assert('DELETE /api/tasks/:id 200', r.ok)
  assert('DELETE returns ok:true', r.data?.ok === true)
  const check = await api('GET', `/api/tasks/${id}`)
  assert('GET after delete → 404', check.status === 404)
}

// ── projects - delete ─────────────────────────────────────────────────────────
section('projects - delete')

{
  const r = await api('DELETE', `/api/projects/${projId}`)
  assert('DELETE /api/projects/:id 200', r.ok)
  assert('DELETE returns ok:true', r.data?.ok === true)
  const check = await api('GET', `/api/projects/${projId}`)
  assert('GET project after delete → 404', check.status === 404)
}

// cleanup
server.stop()
try { unlinkSync(TEST_DB) } catch {}

summary()
process.exit(0)
