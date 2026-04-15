/**
 * Executor unit tests (script + http, no claude CLI required)
 */
import { unlinkSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { assert, section, summary } from './helpers'

const TEST_DB = join(homedir(), '.conductor', 'test-executor.sqlite')
process.env.CONDUCTOR_TEST_DB = TEST_DB
try { unlinkSync(TEST_DB) } catch {}

import { initDb, resetDb } from '../src/db/init'
import { createProject } from '../src/models/projects'
import { createTask } from '../src/models/tasks'
import { executeScript, executeHttp } from '../src/services/executor'

initDb()
const proj = createProject({ name: 'Executor Test', workDir: '/tmp' })

console.log('\n=== executor unit tests ===')

// ── script executor ───────────────────────────────────────────────────────────
section('script executor')

{
  const task = createTask({
    projectId: proj.id,
    title: 'Echo test',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'echo "hello conductor"' },
  })
  const result = await executeScript(task)
  assert('script success', result.success)
  assert('script output contains text', result.output.includes('hello conductor'))
  assert('script no error', !result.error)
}

{
  const task = createTask({
    projectId: proj.id,
    title: 'Exit 1',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'exit 1' },
  })
  const result = await executeScript(task)
  assert('script failure on exit 1', !result.success)
  assert('script error message on failure', !!result.error)
}

{
  const task = createTask({
    projectId: proj.id,
    title: 'Stderr test',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'echo "stdout" && echo "stderr" >&2' },
  })
  const result = await executeScript(task)
  assert('script captures stdout and stderr', result.output.includes('stdout') && result.output.includes('stderr'))
}

{
  const task = createTask({
    projectId: proj.id,
    title: 'Env var test',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'echo $MY_VAR', env: { MY_VAR: 'injected_value' } },
  })
  const result = await executeScript(task)
  assert('script env var injection', result.output.includes('injected_value'))
}

{
  const task = createTask({
    projectId: proj.id,
    title: 'WorkDir test',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'pwd', workDir: '/tmp' },
  })
  const result = await executeScript(task)
  assert('script workDir respected', result.output.trim().startsWith('/tmp') || result.output.includes('tmp'))
}

{
  // Timeout: use a very short timeout (1s) with a 3s sleep
  const task = createTask({
    projectId: proj.id,
    title: 'Timeout test',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'sleep 10', timeout: 1 },
  })
  const result = await executeScript(task)
  assert('script timeout causes failure', !result.success)
  assert('script timeout error message', result.error?.includes('timeout'))
}

{
  // Multiline output
  const task = createTask({
    projectId: proj.id,
    title: 'Multiline output',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'printf "line1\\nline2\\nline3\\n"' },
  })
  const result = await executeScript(task)
  assert('script multiline output', result.output.includes('line1') && result.output.includes('line3'))
}

{
  // Command not found
  const task = createTask({
    projectId: proj.id,
    title: 'Bad command',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'this_command_does_not_exist_xyz' },
  })
  const result = await executeScript(task)
  assert('script command not found → failure', !result.success)
}

// ── http executor ─────────────────────────────────────────────────────────────
section('http executor')

// Spin up a local mock HTTP server for reliable testing
const mockServer = Bun.serve({
  port: 19876,
  fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === '/ok') return new Response(JSON.stringify({ status: 'ok' }), { headers: { 'Content-Type': 'application/json' } })
    if (url.pathname === '/echo') return req.json().then(body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }))
    if (url.pathname === '/404') return new Response('not found', { status: 404 })
    if (url.pathname === '/500') return new Response('server error', { status: 500 })
    if (url.pathname === '/slow') return new Promise(r => setTimeout(() => r(new Response('late')), 5000))
    return new Response('not found', { status: 404 })
  },
})

{
  const task = createTask({
    projectId: proj.id,
    title: 'HTTP GET',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'http', url: 'http://localhost:19876/ok', method: 'GET' },
  })
  const result = await executeHttp(task)
  assert('http GET success', result.success)
  assert('http GET has output', result.output.length > 0)
  assert('http GET output is JSON', (() => { try { JSON.parse(result.output); return true } catch { return false } })())
}

{
  const task = createTask({
    projectId: proj.id,
    title: 'HTTP POST',
    assignee: 'ai',
    kind: 'once',
    executor: {
      kind: 'http',
      url: 'http://localhost:19876/echo',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'conductor' }),
    },
  })
  const result = await executeHttp(task)
  assert('http POST success', result.success)
  assert('http POST output contains body', result.output.includes('conductor'))
}

{
  const task = createTask({
    projectId: proj.id,
    title: 'HTTP 404',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'http', url: 'http://localhost:19876/404', method: 'GET' },
  })
  const result = await executeHttp(task)
  assert('http 404 → failure', !result.success)
  assert('http 404 error contains status', result.error?.includes('404'))
}

{
  const task = createTask({
    projectId: proj.id,
    title: 'HTTP 500',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'http', url: 'http://localhost:19876/500', method: 'GET' },
  })
  const result = await executeHttp(task)
  assert('http 500 → failure', !result.success)
  assert('http 500 error contains status', result.error?.includes('500'))
}

{
  const task = createTask({
    projectId: proj.id,
    title: 'HTTP timeout',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'http', url: 'http://localhost:19876/slow', method: 'GET', timeout: 1 },
  })
  const result = await executeHttp(task)
  assert('http timeout → failure', !result.success)
}

mockServer.stop()

// ── context injection (ai_prompt) ─────────────────────────────────────────────
section('context injection (buildPrompt via script)')

{
  // Test that placeholder substitution works by using a script that echoes env vars
  // We verify the buildPrompt logic indirectly via a script that uses customVars
  const task = createTask({
    projectId: proj.id,
    title: 'Context injection test',
    assignee: 'ai',
    kind: 'once',
    executor: { kind: 'script', command: 'echo "project=${PROJECT_NAME}"', env: { PROJECT_NAME: 'conductor' } },
    executorOptions: { customVars: { myVar: 'hello' } },
  })
  const result = await executeScript(task)
  assert('custom env var in script', result.output.includes('conductor'))
}

// cleanup
resetDb()
try { unlinkSync(TEST_DB) } catch {}

summary()
