import type { Task } from '@conductor/types'

export type TimelineGroup =
  | { kind: 'date'; label: string; tasks: Task[] }
  | { kind: 'recurring'; tasks: Task[] }
  | { kind: 'no_time'; tasks: Task[] }
  | { kind: 'done'; tasks: Task[] }

function getDateLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(d, today)) return '今天'
  if (sameDay(d, tomorrow)) return '明天'

  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
}

function getTaskTime(task: Task): string | null {
  if (!task.scheduleConfig) return null
  if (task.scheduleConfig.kind === 'scheduled') return task.scheduleConfig.scheduledAt
  if (task.scheduleConfig.kind === 'recurring') return task.scheduleConfig.nextRunAt ?? null
  return null
}

export function groupTasksForTimeline(tasks: Task[], assigneeFilter?: 'human' | 'ai'): TimelineGroup[] {
  const filtered = assigneeFilter ? tasks.filter(t => t.assignee === assigneeFilter) : tasks

  const done = filtered.filter(t => t.status === 'done' || t.status === 'cancelled')
  const active = filtered.filter(t => t.status !== 'done' && t.status !== 'cancelled')

  const recurring = active.filter(t => t.kind === 'recurring')
  const nonRecurring = active.filter(t => t.kind !== 'recurring')

  // Tasks with a time (scheduled or once with scheduledAt)
  const withTime = nonRecurring.filter(t => getTaskTime(t) !== null)
  const noTime = nonRecurring.filter(t => getTaskTime(t) === null)

  // Group by date
  const byDate = new Map<string, Task[]>()
  for (const task of withTime) {
    const time = getTaskTime(task)!
    const label = getDateLabel(time)
    if (!byDate.has(label)) byDate.set(label, [])
    byDate.get(label)!.push(task)
  }

  // Sort tasks within each date group by time
  for (const tasks of byDate.values()) {
    tasks.sort((a, b) => {
      const ta = getTaskTime(a) ?? ''
      const tb = getTaskTime(b) ?? ''
      return ta.localeCompare(tb)
    })
  }

  const groups: TimelineGroup[] = []

  // Date groups in chronological order
  const sortedDates = [...byDate.entries()].sort(([, a], [, b]) => {
    const ta = getTaskTime(a[0]) ?? ''
    const tb = getTaskTime(b[0]) ?? ''
    return ta.localeCompare(tb)
  })

  for (const [label, tasks] of sortedDates) {
    groups.push({ kind: 'date', label, tasks })
  }

  if (recurring.length > 0) {
    groups.push({ kind: 'recurring', tasks: recurring })
  }

  if (noTime.length > 0) {
    groups.push({ kind: 'no_time', tasks: noTime })
  }

  if (done.length > 0) {
    groups.push({ kind: 'done', tasks: done })
  }

  return groups
}

export function getTaskTimeDisplay(task: Task): string | null {
  if (!task.scheduleConfig) return null
  if (task.scheduleConfig.kind === 'scheduled') {
    const d = new Date(task.scheduleConfig.scheduledAt)
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  if (task.scheduleConfig.kind === 'recurring' && task.scheduleConfig.nextRunAt) {
    const d = new Date(task.scheduleConfig.nextRunAt)
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return null
}
