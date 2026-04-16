/**
 * CLI integration tests
 * Exercises all task/project/group/prompt commands via bun cli.ts
 * Skipped: daemon, tts, project init (interactive), project brain add (AI env)
 */
import { unlinkSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { $ } from 'bun'
import { assert, section, summary } from './helpers'

const TEST_DB = join(homedir(), '.conductor', 'test-cli.sqlite')
process.env.CONDUCTOR_TEST_DB = TEST_DB
try { unlinkSync(TEST_DB) } catch {}

const CLI = 'packages/core/cli.ts'

async function cli(...args: string[]): Promise<{ stdout: string; stderr: string; ok: boolean; json: any }> {
  try {
    const result = await $`bun ${CLI} ${args}`.env({ ...process.env, CONDUCTOR_TEST_DB: TEST_DB }).quiet()
    const stdout = result.stdout.toString()
    let json: any = null
    try { json = JSON.parse(stdout.trim()) } catch {}
    return { stdout, stderr: result.stderr.toString(), ok: true, json }
  } catch (e: any) {
    const stdout = e.stdout?.toString() ?? ''
    let json: any = null
    try { json = JSON.parse(stdout.trim()) } catch {}
    return { stdout, stderr: e.stderr?.toString() ?? '', ok: false, json }
  }
}

console.log('\n=== CLI integration tests ===')

// ── projects ──────────────────────────────────────────────────────────────────
section('project commands')

let projId: string
let projId2: string

{
  const r = await cli('project', 'create', '--name', 'CLI Test Project', '--goal', 'testing', '--json')
  assert('project create ok', r.ok)
  assert('project create returns id', r.json?.id?.startsWith('proj_'))
  assert('project create name', r.json?.name === 'CLI Test Project')
  assert('project create goal', r.json?.goal === 'testing')
  projId = r.json?.id
}

{
  const r = await cli('project', 'list', '--json')
  assert('project list ok', r.ok)
  assert('project list is array', Array.isArray(r.json))
  assert('project list contains created', r.json?.some((p: any) => p.id === projId))
}

{
  const r = await cli('project', 'get', projId, '--json')
  assert('project get ok', r.ok)
  assert('project get correct id', r.json?.id === projId)
}

{
  // 404 path
  const r = await cli('project', 'get', 'proj_missing', '--json')
  assert('project get missing → non-zero exit', !r.ok)
}

{
  const r = await cli('project', 'update', projId, '--name', 'Updated Project', '--json')
  assert('project update ok', r.ok)
  assert('project update name changed', r.json?.name === 'Updated Project')
}

{
  // Create second project for archive/delete tests
  const r = await cli('project', 'create', '--name', 'Archive Test', '--json')
  assert('project create 2 ok', r.ok)
  projId2 = r.json?.id
}

{
  const r = await cli('project', 'archive', projId2, '--json')
  assert('project archive ok', r.ok)
  assert('project archive sets archived=true', r.json?.archived === true)
}

{
  const r = await cli('project', 'unarchive', projId2, '--json')
  assert('project unarchive ok', r.ok)
  assert('project unarchive sets archived=false', r.json?.archived === false)
}

{
  const r = await cli('project', 'delete', projId2, '--json')
  assert('project delete ok', r.ok)
  assert('project delete returns ok:true', r.json?.ok === true)
}

// ── groups ────────────────────────────────────────────────────────────────────
section('group commands')

let groupId: string

{
  const r = await cli('group', 'create', '--name', 'CLI Test Group', '--json')
  assert('group create ok', r.ok)
  assert('group create returns id', r.json?.id?.startsWith('group_'))
  assert('group create name', r.json?.name === 'CLI Test Group')
  groupId = r.json?.id
}

{
  const r = await cli('group', 'list', '--json')
  assert('group list ok', r.ok)
  // group list returns ProjectsView: { groups, ungrouped }
  assert('group list has groups array', Array.isArray(r.json?.groups))
  assert('group list has ungrouped array', Array.isArray(r.json?.ungrouped))
}

{
  const r = await cli('group', 'get', groupId, '--json')
  assert('group get ok', r.ok)
  assert('group get correct id', r.json?.id === groupId)
}

{
  const r = await cli('group', 'get', 'group_missing', '--json')
  assert('group get missing → non-zero exit', !r.ok)
}

{
  const r = await cli('group', 'update', groupId, '--name', 'Updated Group', '--json')
  assert('group update ok', r.ok)
  assert('group update name changed', r.json?.name === 'Updated Group')
}

{
  const r = await cli('group', 'update', groupId, '--collapse', '--json')
  assert('group update collapse ok', r.ok)
  assert('group update collapsed=true', r.json?.collapsed === true)
}

{
  const r = await cli('group', 'delete', groupId, '--json')
  assert('group delete ok', r.ok)
  assert('group delete returns ok:true', r.json?.ok === true)
}

// ── tasks ─────────────────────────────────────────────────────────────────────
section('task commands')

let humanTaskId: string
let aiTaskId: string

{
  const r = await cli(
    'task', 'create',
    '--title', 'Human CLI task',
    '--project', projId,
    '--assignee', 'human',
    '--kind', 'once',
    '--instructions', 'Do something',
    '--json',
  )
  assert('task create human ok', r.ok)
  assert('task create returns id', r.json?.id?.startsWith('task_'))
  assert('task create assignee=human', r.json?.assignee === 'human')
  assert('task create status=pending', r.json?.status === 'pending')
  humanTaskId = r.json?.id
}

{
  const r = await cli(
    'task', 'create',
    '--title', 'AI script task',
    '--project', projId,
    '--assignee', 'ai',
    '--kind', 'once',
    '--executor-kind', 'script',
    '--script', 'echo hello-cli',
    '--json',
  )
  assert('task create ai ok', r.ok)
  assert('task create ai assignee=ai', r.json?.assignee === 'ai')
  assert('task create executor kind=script', r.json?.executor?.kind === 'script')
  aiTaskId = r.json?.id
}

{
  const r = await cli('task', 'list', '--project', projId, '--json')
  assert('task list ok', r.ok)
  assert('task list is array', Array.isArray(r.json))
  assert('task list contains human task', r.json?.some((t: any) => t.id === humanTaskId))
  assert('task list contains ai task', r.json?.some((t: any) => t.id === aiTaskId))
}

{
  const r = await cli('task', 'list', '--project', projId, '--assignee', 'human', '--json')
  assert('task list filter assignee=human ok', r.ok)
  assert('task list filter only human tasks', r.json?.every((t: any) => t.assignee === 'human'))
}

{
  const r = await cli('task', 'get', humanTaskId, '--json')
  assert('task get ok', r.ok)
  assert('task get correct id', r.json?.id === humanTaskId)
}

{
  const r = await cli('task', 'get', 'task_missing', '--json')
  assert('task get missing → non-zero exit', !r.ok)
}

{
  const r = await cli('task', 'update', humanTaskId, '--title', 'Updated Human Task', '--json')
  assert('task update ok', r.ok)
  assert('task update title changed', r.json?.title === 'Updated Human Task')
}

{
  // task run (synchronous) — runs the echo script
  const r = await cli('task', 'run', aiTaskId, '--json')
  assert('task run ok', r.ok)
  assert('task run returns task', r.json?.id === aiTaskId)
  assert('task run status=done', r.json?.status === 'done')
}

{
  const r = await cli('task', 'logs', aiTaskId, '--json')
  assert('task logs ok', r.ok)
  assert('task logs is array', Array.isArray(r.json))
  assert('task logs has entry', r.json?.length >= 1)
  assert('task logs entry has status', typeof r.json?.[0]?.status === 'string')
}

{
  const r = await cli('task', 'ops', aiTaskId, '--json')
  assert('task ops ok', r.ok)
  assert('task ops is array', Array.isArray(r.json))
  assert('task ops has entry', r.json?.length >= 1)
}

{
  // task done (human task)
  const r = await cli('task', 'done', humanTaskId, '--output', 'finished', '--json')
  assert('task done ok', r.ok)
  assert('task done status=done', r.json?.status === 'done')
}

{
  // Create another human task to cancel
  const created = await cli('task', 'create', '--title', 'To cancel', '--project', projId, '--assignee', 'human', '--kind', 'once', '--json')
  const cancelId = created.json?.id
  const r = await cli('task', 'cancel', cancelId, '--json')
  assert('task cancel ok', r.ok)
  assert('task cancel status=cancelled', r.json?.status === 'cancelled')
}

{
  // Create another task to delete
  const created = await cli('task', 'create', '--title', 'To delete', '--project', projId, '--assignee', 'human', '--kind', 'once', '--json')
  const delId = created.json?.id
  const r = await cli('task', 'delete', delId, '--json')
  assert('task delete ok', r.ok)
  assert('task delete returns ok:true', r.json?.ok === true)
}

// ── prompts ───────────────────────────────────────────────────────────────────
section('prompt commands')

{
  const r = await cli('prompt', 'set', 'System-level test prompt')
  assert('prompt set system ok', r.ok)
}

{
  const r = await cli('prompt', 'get', '--json')
  assert('prompt get system ok', r.ok)
  assert('prompt get has content', r.json?.content === 'System-level test prompt')
}

{
  // prompt set has no --json flag, check exit code only
  const r = await cli('prompt', 'set', 'Project-level prompt', '--project', projId)
  assert('prompt set project ok', r.ok)
}

{
  const r = await cli('prompt', 'get', '--project', projId, '--json')
  assert('prompt get project ok', r.ok)
  assert('prompt get project content', r.json?.content === 'Project-level prompt')
}

{
  const r = await cli('prompt', 'delete', '--project', projId, '--json')
  assert('prompt delete project ok', r.ok)
  assert('prompt delete returns ok:true', r.json?.ok === true)
}

{
  const r = await cli('prompt', 'get', '--project', projId, '--json')
  assert('prompt get after delete → non-zero exit', !r.ok)
}

// cleanup
try { unlinkSync(TEST_DB) } catch {}

summary()
process.exit(0)
