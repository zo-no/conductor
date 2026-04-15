import type { Project, Task, TaskLog, TaskOp, SystemPrompt } from '@conductor/types'

// ─── symbols ──────────────────────────────────────────────────────────────────

const ASSIGNEE = {
  ai:    '[AI]',
  human: '[人]',
}

const STATUS_EMOJI: Record<string, string> = {
  pending:   '⏳',
  running:   '🔄',
  done:      '✅',
  failed:    '❌',
  cancelled: '🚫',
  blocked:   '🔒',
}

const KIND_LABEL: Record<string, string> = {
  once:      'once',
  scheduled: 'sched',
  recurring: 'recur',
}

// ─── formatting helpers ───────────────────────────────────────────────────────

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, len)
  return s + ' '.repeat(len - s.length)
}

function shortId(id: string): string {
  // proj_abc123def456 → abc123
  const hex = id.split('_')[1] ?? id
  return hex.slice(0, 8)
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

// ─── formatters ───────────────────────────────────────────────────────────────

function formatProject(p: Project): string {
  const archived = p.archived ? ' [archived]' : ''
  const goal = p.goal ? `  ${p.goal}` : ''
  return `${shortId(p.id)}  ${p.name}${archived}${goal}`
}

function formatTask(t: Task): string {
  const emoji = STATUS_EMOJI[t.status] ?? '?'
  const assignee = ASSIGNEE[t.assignee] ?? t.assignee
  const kind = KIND_LABEL[t.kind] ?? t.kind
  const title = pad(t.title, 32)
  const id = shortId(t.id)
  const age = relativeTime(t.updatedAt)

  let extra = ''
  if (t.status === 'blocked' && t.blockedByTaskId) {
    extra = `  ← waiting for ${shortId(t.blockedByTaskId)}`
  } else if (t.kind === 'recurring' && t.scheduleConfig?.kind === 'recurring') {
    extra = `  cron: ${t.scheduleConfig.cron}`
  } else if (t.kind === 'scheduled' && t.scheduleConfig?.kind === 'scheduled') {
    extra = `  at: ${t.scheduleConfig.scheduledAt.slice(0, 16)}`
  } else if (t.completionOutput && t.status === 'done') {
    const preview = t.completionOutput.slice(0, 40).replace(/\n/g, ' ')
    extra = `  → ${preview}`
  }

  return `${emoji} ${assignee}  ${title}  ${pad(kind, 5)}  ${pad(t.status, 9)}  ${id}  ${age}${extra}`
}

function formatLog(l: TaskLog): string {
  const emoji = l.status === 'success' ? '✅' : l.status === 'failed' ? '❌' : l.status === 'skipped' ? '⏭️' : '🚫'
  const age = relativeTime(l.startedAt)
  const duration = l.completedAt
    ? `${Math.round((new Date(l.completedAt).getTime() - new Date(l.startedAt).getTime()) / 1000)}s`
    : '-'
  const output = l.output ? `\n    ${l.output.slice(0, 120).replace(/\n/g, '\n    ')}` : ''
  const skip = l.skipReason ? `  skip: ${l.skipReason}` : ''
  return `${emoji}  ${l.status}  ${age}  ${duration}  [${l.triggeredBy}]${skip}${output}`
}

function formatOp(o: TaskOp): string {
  const age = relativeTime(o.createdAt)
  const transition = o.fromStatus && o.toStatus ? `  ${o.fromStatus} → ${o.toStatus}` : ''
  const note = o.note ? `  (${o.note})` : ''
  return `  ${pad(o.op, 16)}  ${o.actor}  ${age}${transition}${note}`
}

function formatPrompt(p: SystemPrompt): string {
  const scope = p.key === 'default' ? 'system' : `project:${p.key.replace('proj_', '')}`
  const age = relativeTime(p.updatedAt)
  const preview = p.content.slice(0, 80).replace(/\n/g, ' ')
  return `[${scope}]  ${age}\n  ${preview}${p.content.length > 80 ? '…' : ''}`
}

// ─── public API ───────────────────────────────────────────────────────────────

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

export function print(data: unknown, json: boolean): void {
  if (json) {
    printJson(data)
    return
  }

  if (data === null || data === undefined) {
    console.log('(empty)')
    return
  }

  // Arrays
  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.log('(empty)')
      return
    }

    const first = data[0]

    if (isTask(first)) {
      const header = `${'  '}  ${'ASSIGNEE'.padEnd(5)}  ${'TITLE'.padEnd(32)}  ${'KIND '.padEnd(5)}  ${'STATUS   '}  ${'ID      '}  UPDATED`
      console.log(header)
      console.log('─'.repeat(header.length))
      for (const t of data as Task[]) console.log(formatTask(t))
      return
    }

    if (isProject(first)) {
      console.log(`${'ID      '}  NAME`)
      console.log('─'.repeat(50))
      for (const p of data as Project[]) console.log(formatProject(p))
      return
    }

    if (isTaskLog(first)) {
      for (const l of data as TaskLog[]) console.log(formatLog(l))
      return
    }

    if (isTaskOp(first)) {
      console.log(`  ${'OP              '}  ${'ACTOR   '}  ${'WHEN  '}  TRANSITION`)
      console.log('─'.repeat(60))
      for (const o of data as TaskOp[]) console.log(formatOp(o))
      return
    }

    // fallback
    printJson(data)
    return
  }

  // Single objects
  if (isTask(data)) { console.log(formatTask(data as Task)); return }
  if (isProject(data)) { console.log(formatProject(data as Project)); return }
  if (isTaskLog(data)) { console.log(formatLog(data as TaskLog)); return }
  if (isTaskOp(data)) { console.log(formatOp(data as TaskOp)); return }
  if (isPrompt(data)) { console.log(formatPrompt(data as SystemPrompt)); return }
  if ((data as any).ok === true) { console.log('✓ ok'); return }

  printJson(data)
}

export function error(msg: string): void {
  console.error(`❌  ${msg}`)
  process.exit(1)
}

// ─── type guards ──────────────────────────────────────────────────────────────

function isTask(x: unknown): x is Task {
  return typeof x === 'object' && x !== null && 'assignee' in x && 'kind' in x && 'status' in x
}

function isProject(x: unknown): x is Project {
  return typeof x === 'object' && x !== null && 'archived' in x && 'name' in x && !('assignee' in x)
}

function isTaskLog(x: unknown): x is TaskLog {
  return typeof x === 'object' && x !== null && 'triggeredBy' in x && 'startedAt' in x
}

function isTaskOp(x: unknown): x is TaskOp {
  return typeof x === 'object' && x !== null && 'op' in x && 'actor' in x && 'taskId' in x
}

function isPrompt(x: unknown): x is SystemPrompt {
  return typeof x === 'object' && x !== null && 'key' in x && 'content' in x && 'updatedAt' in x
}
