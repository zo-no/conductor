import { spawn } from 'child_process'
import { homedir } from 'os'
import { join, resolve } from 'path'
import type { Task, ScriptExecutor, AiPromptExecutor, HttpExecutor } from '@conductor/types'
import { getTask } from '../models/tasks'
import { getProject } from '../models/projects'
import { getDefaultPrompt, getSystemPrompt, getProjectPromptKey } from '../models/system-prompts'
import { createRun, completeRun, appendSpoolLine } from '../models/task-runs'
import { emit } from './events'

// ─── Context injection ────────────────────────────────────────────────────────

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

function buildVars(task: Task): Record<string, string> {
  const project = getProject(task.projectId)
  return {
    date: new Date().toISOString().slice(0, 10),
    datetime: new Date().toISOString(),
    taskTitle: task.title,
    taskDescription: task.description ?? '',
    projectName: project?.name ?? '',
    completionOutput: task.completionOutput ?? '',
    ...(task.executorOptions?.customVars ?? {}),
  }
}

/**
 * Build the user-facing prompt (task-level only).
 * System/project prompts are passed via --append-system-prompt separately.
 */
function buildUserPrompt(task: Task): string {
  const executor = task.executor as AiPromptExecutor
  return interpolate(executor.prompt, buildVars(task))
}

/**
 * Build the system prompt appendix (system-level + project-level).
 * Returns null if neither is set.
 */
function buildSystemPromptAppend(task: Task): string | null {
  const defaultPrompt = getDefaultPrompt()
  const projectPrompt = getSystemPrompt(getProjectPromptKey(task.projectId))

  const parts: string[] = []
  if (defaultPrompt) parts.push(interpolate(defaultPrompt.content, buildVars(task)))
  if (projectPrompt) parts.push(interpolate(projectPrompt.content, buildVars(task)))

  return parts.length > 0 ? parts.join('\n\n') : null
}

function resolveCwd(folder?: string): string {
  if (!folder || folder === '~') return homedir()
  if (folder.startsWith('~/')) return join(homedir(), folder.slice(2))
  return resolve(folder)
}

// ─── Execution result ─────────────────────────────────────────────────────────

export interface ExecutionResult {
  success: boolean
  output: string
  error?: string
  sessionId?: string
}

// ─── Script executor ──────────────────────────────────────────────────────────

export function executeScript(task: Task): Promise<ExecutionResult> {
  const executor = task.executor as ScriptExecutor
  const project = getProject(task.projectId)
  const cwd = resolveCwd(executor.workDir ?? project?.workDir)
  const timeout = (executor.timeout ?? 300) * 1000

  return new Promise((resolve) => {
    const proc = spawn('sh', ['-c', executor.command], {
      cwd,
      env: { ...process.env, ...(executor.env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    proc.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    proc.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))

    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGTERM')
      setTimeout(() => proc.kill('SIGKILL'), 15_000)
    }, timeout)

    proc.on('close', (code) => {
      clearTimeout(timer)
      const output = [...stdout, ...stderr].map(b => b.toString()).join('')
      if (timedOut) {
        resolve({ success: false, output, error: 'execution timeout' })
      } else if (code === 0) {
        resolve({ success: true, output })
      } else {
        resolve({ success: false, output, error: `exited with code ${code}` })
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      resolve({ success: false, output: '', error: err.message })
    })
  })
}

// ─── AI prompt executor ───────────────────────────────────────────────────────

// Extract session ID from claude stream-json output
function extractClaudeSessionId(line: string): string | undefined {
  try {
    const obj = JSON.parse(line)
    // claude emits session_id in the 'system' event
    if (obj.type === 'system' && obj.session_id) return obj.session_id as string
  } catch {}
  return undefined
}

// Extract session ID from codex --json output
function extractCodexSessionId(line: string): string | undefined {
  try {
    const obj = JSON.parse(line)
    if (obj.session_id) return obj.session_id as string
    if (obj.type === 'session' && obj.id) return obj.id as string
  } catch {}
  return undefined
}

function buildClaudeArgs(task: Task, userPrompt: string, systemAppend: string | null): string[] {
  const executor = task.executor as AiPromptExecutor
  const continueSession = task.executorOptions?.continueSession ?? false
  const sessionId = task.lastSessionId

  const args: string[] = []

  if (continueSession && sessionId) {
    args.push('--resume', sessionId)
  }

  args.push('-p', userPrompt, '--output-format', 'stream-json', '--verbose')
  if (systemAppend) args.push('--append-system-prompt', systemAppend)
  if (executor.model) args.push('--model', executor.model)

  return args
}

function buildCodexArgs(task: Task, userPrompt: string): string[] {
  const executor = task.executor as AiPromptExecutor
  const continueSession = task.executorOptions?.continueSession ?? false
  const sessionId = task.lastSessionId

  const args: string[] = ['exec']

  if (continueSession && sessionId) {
    // codex exec resume <sessionId> <prompt>
    return ['exec', 'resume', sessionId, userPrompt, '--json', '--full-auto']
  }

  args.push(userPrompt, '--json', '--full-auto')
  if (executor.model) args.push('--model', executor.model)

  return args
}

export function executeAiPrompt(
  task: Task,
  triggeredBy: 'manual' | 'scheduler' | 'api' | 'cli' = 'manual',
): Promise<ExecutionResult> {
  const executor = task.executor as AiPromptExecutor
  const agent = executor.agent ?? 'claude'
  const project = getProject(task.projectId)
  const cwd = resolveCwd(project?.workDir)
  const userPrompt = buildUserPrompt(task)
  const systemAppend = buildSystemPromptAppend(task)
  const timeout = 300_000 // 5 min

  const bin = agent === 'codex' ? 'codex' : 'claude'
  const args = agent === 'codex'
    ? buildCodexArgs(task, userPrompt)
    : buildClaudeArgs(task, userPrompt, systemAppend)

  const run = createRun(task.id, triggeredBy)

  return new Promise((resolve) => {
    const proc = spawn(bin, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let lastAssistantText = ''
    let sessionId: string | undefined
    let timedOut = false

    const { createInterface } = require('readline')
    const rl = createInterface({ input: proc.stdout })
    rl.on('line', (line: string) => {
      appendSpoolLine(run.id, line)
      emit({ type: 'run_line', data: { taskId: task.id, runId: run.id, line, ts: new Date().toISOString() } })

      // Extract session ID
      if (!sessionId) {
        sessionId = agent === 'codex'
          ? extractCodexSessionId(line)
          : extractClaudeSessionId(line)
      }

      // Extract last assistant text
      try {
        const obj = JSON.parse(line)
        if (agent === 'claude' && obj.type === 'assistant') {
          const content = obj.message?.content
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text') lastAssistantText = block.text
            }
          }
        } else if (agent === 'codex' && obj.type === 'message' && obj.role === 'assistant') {
          if (typeof obj.content === 'string') lastAssistantText = obj.content
        }
      } catch {}
    })

    const stderrLines: string[] = []
    proc.stderr.on('data', (chunk: Buffer) => stderrLines.push(chunk.toString()))

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGTERM')
      setTimeout(() => proc.kill('SIGKILL'), 15_000)
    }, timeout)

    proc.on('close', (code) => {
      clearTimeout(timer)
      const output = lastAssistantText
      const stderr = stderrLines.join('')

      if (timedOut) {
        completeRun(run.id, 'failed', 'execution timeout', sessionId)
        resolve({ success: false, output, error: 'execution timeout' })
      } else if (code === 0) {
        completeRun(run.id, 'done', undefined, sessionId)
        resolve({ success: true, output, sessionId })
      } else {
        const err = stderr || `exited with code ${code}`
        completeRun(run.id, 'failed', err, sessionId)
        resolve({ success: false, output, error: err, sessionId })
      }
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      resolve({ success: false, output: '', error: err.message })
    })
  })
}

// ─── HTTP executor ────────────────────────────────────────────────────────────

export async function executeHttp(task: Task): Promise<ExecutionResult> {
  const executor = task.executor as HttpExecutor
  const timeout = (executor.timeout ?? 30) * 1000

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(executor.url, {
      method: executor.method,
      headers: executor.headers,
      body: executor.body ?? undefined,
      signal: controller.signal,
    })

    clearTimeout(timer)
    const text = await response.text()

    if (response.ok) {
      return { success: true, output: text }
    } else {
      return { success: false, output: text, error: `HTTP ${response.status}` }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, output: '', error: message }
  }
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

export async function executeTask(taskId: string): Promise<ExecutionResult> {
  const task = getTask(taskId)
  if (!task) return { success: false, output: '', error: 'task not found' }
  if (!task.executor) return { success: false, output: '', error: 'no executor configured' }

  switch (task.executor.kind) {
    case 'script':    return executeScript(task)
    case 'ai_prompt': return executeAiPrompt(task)
    case 'http':      return executeHttp(task)
  }
}
