import { useState, useEffect } from 'react'
import type { Task, TaskAssignee, TaskKind, TaskExecutor, ScheduleConfig } from '@conductor/types'
import { api } from '../../lib/api'

interface Props {
  projectId: string
  task?: Task
  onDone: () => void
  onCancel: () => void
}

type ExecutorKind = 'none' | 'ai_prompt' | 'script' | 'http'
type ScheduleKind = 'none' | 'scheduled' | 'recurring'

// ─── Utility ─────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

// ─── Row — tappable list row with label + value ───────────────────────────────

function Row({
  icon, label, value, accent, onClick, children,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  accent?: boolean
  onClick?: () => void
  children?: React.ReactNode
}) {
  const base = 'flex items-center gap-3 px-4 py-3.5 w-full text-left'
  const interactive = onClick ? 'active:bg-gray-50 cursor-pointer' : ''
  return (
    <div className={`${base} ${interactive}`} onClick={onClick}>
      <span className="text-gray-400 flex-shrink-0 w-5 flex items-center justify-center">{icon}</span>
      <span className="flex-1 text-sm text-gray-700">{label}</span>
      {value !== undefined && (
        <span className={`text-sm font-medium ${accent ? 'text-blue-500' : 'text-gray-400'}`}>
          {value}
        </span>
      )}
      {children}
      {onClick && (
        <svg className="w-4 h-4 text-gray-300 flex-shrink-0 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </div>
  )
}

function RowDivider() {
  return <div className="h-px bg-gray-100 mx-4" />
}

function CardSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 my-3 bg-white rounded-2xl overflow-hidden divide-y divide-gray-100 shadow-sm border border-gray-100">
      {children}
    </div>
  )
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  icon, label, checked, onChange,
}: {
  icon: React.ReactNode
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 w-full">
      <span className="text-gray-400 flex-shrink-0 w-5 flex items-center justify-center">{icon}</span>
      <span className="flex-1 text-sm text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-blue-500' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}

// ─── Sub-screens ──────────────────────────────────────────────────────────────

type Screen =
  | 'main'
  | 'schedule-kind'
  | 'scheduled-date'
  | 'scheduled-time'
  | 'recurring-preset'
  | 'recurring-time'
  | 'executor-kind'
  | 'prompt'
  | 'script'
  | 'http'
  | 'depends-on'

// ─── Calendar picker ──────────────────────────────────────────────────────────

function CalendarPicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(value ? new Date(value).getFullYear() : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(value ? new Date(value).getMonth() : today.getMonth())

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const selectedDate = value ? new Date(value) : null
  const isSelected = (d: number) => selectedDate?.getFullYear() === viewYear && selectedDate?.getMonth() === viewMonth && selectedDate?.getDate() === d
  const isToday = (d: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d

  const monthLabel = `${viewYear}年${viewMonth + 1}月`
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  function select(d: number) {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    onChange(iso)
  }

  return (
    <div className="px-4 py-3">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-bold text-gray-900">{monthLabel}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => { const d = new Date(viewYear, viewMonth - 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }}
            className="p-1.5 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button type="button" onClick={() => { const d = new Date(viewYear, viewMonth + 1); setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }}
            className="p-1.5 text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map(d => (
          <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
        ))}
      </div>
      {/* Days */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => d === null ? <div key={`e${i}`} /> : (
          <button
            key={d}
            type="button"
            onClick={() => select(d)}
            className={`mx-auto w-9 h-9 rounded-full text-sm flex items-center justify-center transition-colors
              ${isSelected(d) ? 'bg-blue-500 text-white font-semibold' : isToday(d) ? 'text-blue-500 font-semibold' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Time picker (hour × minute wheel-style) ──────────────────────────────────

function TimePicker({ hour, minute, onChange }: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = [0, 15, 30, 45]

  return (
    <div className="px-4 py-3">
      <p className="text-xs text-gray-400 mb-3">选择时间</p>
      <div className="text-center text-3xl font-bold text-blue-500 mb-4">
        {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
      </div>
      {/* Hour grid */}
      <p className="text-xs text-gray-400 mb-2">小时</p>
      <div className="grid grid-cols-6 gap-1.5 mb-4">
        {hours.map(h => (
          <button
            key={h}
            type="button"
            onClick={() => onChange(h, minute)}
            className={`py-1.5 rounded-lg text-sm transition-colors
              ${h === hour ? 'bg-blue-500 text-white font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {String(h).padStart(2, '0')}
          </button>
        ))}
      </div>
      {/* Minute */}
      <p className="text-xs text-gray-400 mb-2">分钟</p>
      <div className="grid grid-cols-4 gap-1.5">
        {minutes.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(hour, m)}
            className={`py-2 rounded-lg text-sm transition-colors
              ${m === minute ? 'bg-blue-500 text-white font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            :{String(m).padStart(2, '0')}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Recurring preset picker ──────────────────────────────────────────────────

type RecurringPreset = 'daily' | 'weekday' | 'weekly' | 'monthly' | 'hourly' | 'custom'

const PRESETS: { value: RecurringPreset; label: string; desc: string; cron: string }[] = [
  { value: 'daily',   label: '每天',    desc: '每天执行一次',   cron: '0 9 * * *' },
  { value: 'weekday', label: '工作日',  desc: '周一至周五',     cron: '0 9 * * 1-5' },
  { value: 'weekly',  label: '每周一',  desc: '每周一执行',     cron: '0 9 * * 1' },
  { value: 'monthly', label: '每月1日', desc: '每月第一天',     cron: '0 9 1 * *' },
  { value: 'hourly',  label: '每小时',  desc: '每整点执行',     cron: '0 * * * *' },
  { value: 'custom',  label: '自定义',  desc: 'Cron 表达式',    cron: '' },
]

function cronToPreset(cron: string): RecurringPreset {
  const match = PRESETS.find(p => p.value !== 'custom' && p.cron.replace('9', cron.split(' ')[1] ?? '9') === cron)
  return match ? match.value : 'custom'
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function TaskForm({ projectId, task, onDone, onCancel }: Props) {
  const isMobile = useIsMobile()
  const isEdit = !!task

  // Core fields
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [assignee, setAssignee] = useState<TaskAssignee>(task?.assignee ?? 'human')

  // Schedule
  const initSchedKind: ScheduleKind =
    task?.scheduleConfig?.kind === 'scheduled' ? 'scheduled'
    : task?.scheduleConfig?.kind === 'recurring' ? 'recurring'
    : 'none'
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>(initSchedKind)

  // scheduled: separate date + time
  const initScheduledAt = task?.scheduleConfig?.kind === 'scheduled' ? task.scheduleConfig.scheduledAt : ''
  const [scheduledDate, setScheduledDate] = useState(() => initScheduledAt ? initScheduledAt.slice(0, 10) : '')
  const [scheduledHour, setScheduledHour] = useState(() => initScheduledAt ? new Date(initScheduledAt).getHours() : 9)
  const [scheduledMinute, setScheduledMinute] = useState(() => initScheduledAt ? new Date(initScheduledAt).getMinutes() : 0)

  // recurring
  const [cron, setCron] = useState(task?.scheduleConfig?.kind === 'recurring' ? task.scheduleConfig.cron : '0 9 * * *')
  const [recurringHour, setRecurringHour] = useState(() => {
    const parts = (task?.scheduleConfig?.kind === 'recurring' ? task.scheduleConfig.cron : '0 9 * * *').split(' ')
    const h = parseInt(parts[1] ?? '9')
    return isNaN(h) ? 9 : h
  })
  const [recurringMinute, setRecurringMinute] = useState(0)

  // Executor
  const initExKind: ExecutorKind = task?.executor?.kind ?? 'none'
  const [executorKind, setExecutorKind] = useState<ExecutorKind>(initExKind)
  const [prompt, setPrompt] = useState(task?.executor?.kind === 'ai_prompt' ? task.executor.prompt : '')
  const [model, setModel] = useState(task?.executor?.kind === 'ai_prompt' ? (task.executor.model ?? '') : '')
  const [agent, setAgent] = useState<'claude' | 'codex'>(
    task?.executor?.kind === 'ai_prompt' ? (task.executor.agent ?? 'claude') : 'claude'
  )
  const [command, setCommand] = useState(task?.executor?.kind === 'script' ? task.executor.command : '')
  const [workDir, setWorkDir] = useState(task?.executor?.kind === 'script' ? (task.executor.workDir ?? '') : '')
  const [httpUrl, setHttpUrl] = useState(task?.executor?.kind === 'http' ? task.executor.url : '')
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>(
    task?.executor?.kind === 'http' ? task.executor.method : 'POST'
  )
  const [httpBody, setHttpBody] = useState(task?.executor?.kind === 'http' ? (task.executor.body ?? '') : '')
  const [httpHeaders, setHttpHeaders] = useState(
    task?.executor?.kind === 'http' && task.executor.headers
      ? Object.entries(task.executor.headers).map(([k, v]) => `${k}: ${v}`).join('\n')
      : ''
  )
  const [continueSession, setContinueSession] = useState(task?.executorOptions?.continueSession ?? false)
  const [reviewOnComplete, setReviewOnComplete] = useState(task?.executorOptions?.reviewOnComplete ?? false)

  // dependsOn
  const [dependsOn, setDependsOn] = useState(task?.dependsOn ?? '')
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  useEffect(() => {
    api.tasks.list({ projectId }).then(ts => setAvailableTasks(ts.filter(t => t.id !== task?.id)))
  }, [projectId, task?.id])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [screen, setScreen] = useState<Screen>('main')

  const isAI = assignee === 'ai' || isEdit

  // ── Derived display values ───────────────────────────────────────────────

  function executorDisplay(): string {
    if (executorKind === 'none') return '无'
    if (executorKind === 'ai_prompt') return agent === 'claude' ? 'Claude' : 'Codex'
    if (executorKind === 'script') return command ? command.slice(0, 20) + (command.length > 20 ? '…' : '') : '配置脚本'
    if (executorKind === 'http') return httpUrl ? `${httpMethod} ${httpUrl.slice(0, 20)}` : '配置 HTTP'
    return ''
  }

  function dependsOnDisplay(): string {
    if (!dependsOn) return '无'
    const t = availableTasks.find(t => t.id === dependsOn)
    return t ? t.title : dependsOn
  }

  // ── Build payload ────────────────────────────────────────────────────────

  function buildScheduledAt(): string {
    if (!scheduledDate) return ''
    return new Date(`${scheduledDate}T${String(scheduledHour).padStart(2,'0')}:${String(scheduledMinute).padStart(2,'0')}:00`).toISOString()
  }

  function buildCron(): string {
    const preset = cronToPreset(cron)
    if (preset === 'custom') return cron
    const p = PRESETS.find(x => x.value === preset)
    if (!p) return cron
    const parts = p.cron.split(' ')
    parts[0] = String(recurringMinute)
    parts[1] = String(recurringHour)
    return parts.join(' ')
  }

  function buildExecutor(): TaskExecutor | undefined {
    if (executorKind === 'ai_prompt') return { kind: 'ai_prompt', prompt, agent, ...(model ? { model } : {}) }
    if (executorKind === 'script') return { kind: 'script', command, ...(workDir ? { workDir } : {}) }
    if (executorKind === 'http') {
      const headers: Record<string, string> = {}
      for (const line of httpHeaders.split('\n')) {
        const idx = line.indexOf(':')
        if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
      }
      return { kind: 'http', url: httpUrl, method: httpMethod, ...(httpBody ? { body: httpBody } : {}), ...(Object.keys(headers).length ? { headers } : {}) }
    }
    return undefined
  }

  function buildScheduleConfig(): ScheduleConfig | undefined {
    if (scheduleKind === 'scheduled') {
      const iso = buildScheduledAt()
      if (!iso) return undefined
      return { kind: 'scheduled', scheduledAt: iso }
    }
    if (scheduleKind === 'recurring') {
      const c = buildCron()
      if (!c) return undefined
      const existing = task?.scheduleConfig?.kind === 'recurring' ? task.scheduleConfig : {}
      return { kind: 'recurring', cron: c, ...(existing as any) }
    }
    return undefined
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('标题不能为空'); return }
    if (executorKind === 'ai_prompt' && !prompt.trim()) { setError('Prompt 不能为空'); return }
    if (executorKind === 'script' && !command.trim()) { setError('命令不能为空'); return }
    if (executorKind === 'http' && !httpUrl.trim()) { setError('URL 不能为空'); return }
    if (scheduleKind === 'scheduled' && !scheduledDate) { setError('请选择执行日期'); return }
    if (scheduleKind === 'recurring' && !buildCron().trim()) { setError('请设置执行周期'); return }

    setSaving(true)
    setError('')
    try {
      const executor = buildExecutor()
      const scheduleConfig = buildScheduleConfig()
      const executorOptions = executor ? { continueSession, reviewOnComplete } : undefined
      const taskKind: TaskKind = scheduleKind === 'recurring' ? 'recurring'
        : scheduleKind === 'scheduled' ? 'scheduled' : 'once'

      if (isEdit) {
        await api.tasks.update(task!.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          executor,
          scheduleConfig,
          executorOptions,
          dependsOn: dependsOn || undefined,
        } as any)
      } else {
        await api.tasks.create({
          projectId,
          title: title.trim(),
          description: description.trim() || undefined,
          assignee,
          kind: taskKind,
          executor,
          scheduleConfig,
          executorOptions,
          dependsOn: dependsOn || undefined,
        })
      }
      onDone()
    } catch (e: any) {
      setError(e.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // ── Screen renderer ──────────────────────────────────────────────────────

  function renderScreen() {
    if (screen === 'schedule-kind') {
      return (
        <>
          <SheetHeader title="触发方式" onBack={() => setScreen('main')} onConfirm={() => setScreen('main')} />
          <div className="overflow-y-auto flex-1">
            <CardSection>
              {(['none', 'scheduled', 'recurring'] as ScheduleKind[]).map((k, i, arr) => (
                <div key={k}>
                  <button
                    type="button"
                    className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-gray-50"
                    onClick={() => { setScheduleKind(k); setScreen('main') }}
                  >
                    <span className="flex-1 text-sm text-gray-700">
                      {{ none: '手动触发', scheduled: '定时执行（一次）', recurring: '周期重复' }[k]}
                    </span>
                    {scheduleKind === k && (
                      <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  {i < arr.length - 1 && <RowDivider />}
                </div>
              ))}
            </CardSection>
          </div>
        </>
      )
    }

    if (screen === 'scheduled-date') {
      return (
        <>
          <SheetHeader title="选择日期" onBack={() => setScreen('main')} onConfirm={() => setScreen('main')} />
          <div className="overflow-y-auto flex-1">
            <CalendarPicker value={scheduledDate} onChange={d => { setScheduledDate(d); }} />
            <CardSection>
              <Row
                icon={<ClockIcon />}
                label="时间"
                value={`${String(scheduledHour).padStart(2,'0')}:${String(scheduledMinute).padStart(2,'0')}`}
                accent
                onClick={() => setScreen('scheduled-time')}
              />
            </CardSection>
          </div>
        </>
      )
    }

    if (screen === 'scheduled-time') {
      return (
        <>
          <SheetHeader title="选择时间" onBack={() => setScreen('scheduled-date')} onConfirm={() => setScreen('scheduled-date')} />
          <div className="overflow-y-auto flex-1">
            <TimePicker hour={scheduledHour} minute={scheduledMinute} onChange={(h, m) => { setScheduledHour(h); setScheduledMinute(m) }} />
          </div>
        </>
      )
    }

    if (screen === 'recurring-preset') {
      const preset = cronToPreset(cron)
      return (
        <>
          <SheetHeader title="重复频率" onBack={() => setScreen('main')} onConfirm={() => setScreen('main')} />
          <div className="overflow-y-auto flex-1">
            <CardSection>
              {PRESETS.map((p, i) => (
                <div key={p.value}>
                  <button
                    type="button"
                    className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-gray-50"
                    onClick={() => {
                      if (p.value !== 'custom') {
                        const parts = p.cron.split(' ')
                        parts[0] = String(recurringMinute)
                        parts[1] = String(recurringHour)
                        setCron(parts.join(' '))
                      } else {
                        setCron('')
                      }
                      setScreen('main')
                    }}
                  >
                    <div className="flex-1">
                      <div className="text-sm text-gray-700">{p.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{p.desc}</div>
                    </div>
                    {preset === p.value && (
                      <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  {i < PRESETS.length - 1 && <RowDivider />}
                </div>
              ))}
            </CardSection>
          </div>
        </>
      )
    }

    if (screen === 'recurring-time') {
      return (
        <>
          <SheetHeader title="执行时间" onBack={() => setScreen('main')} onConfirm={() => setScreen('main')} />
          <div className="overflow-y-auto flex-1">
            <TimePicker hour={recurringHour} minute={recurringMinute} onChange={(h, m) => {
              setRecurringHour(h); setRecurringMinute(m)
              const preset = cronToPreset(cron)
              const p = PRESETS.find(x => x.value === preset)
              if (p && preset !== 'custom') {
                const parts = p.cron.split(' ')
                parts[0] = String(m)
                parts[1] = String(h)
                setCron(parts.join(' '))
              }
            }} />
          </div>
        </>
      )
    }

    if (screen === 'executor-kind') {
      return (
        <>
          <SheetHeader title="执行器" onBack={() => setScreen('main')} onConfirm={() => setScreen('main')} />
          <div className="overflow-y-auto flex-1">
            <CardSection>
              {([
                { value: 'none' as ExecutorKind, label: '无', desc: '仅记录，不自动执行' },
                { value: 'ai_prompt' as ExecutorKind, label: 'AI Prompt', desc: '调用 Claude / Codex' },
                { value: 'script' as ExecutorKind, label: '脚本', desc: '运行 Shell 命令' },
                { value: 'http' as ExecutorKind, label: 'HTTP', desc: '调用 HTTP 接口' },
              ]).map((opt, i, arr) => (
                <div key={opt.value}>
                  <button
                    type="button"
                    className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-gray-50"
                    onClick={() => { setExecutorKind(opt.value); setScreen('main') }}
                  >
                    <div className="flex-1">
                      <div className="text-sm text-gray-700">{opt.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                    </div>
                    {executorKind === opt.value && (
                      <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  {i < arr.length - 1 && <RowDivider />}
                </div>
              ))}
            </CardSection>
          </div>
        </>
      )
    }

    if (screen === 'prompt') {
      return (
        <>
          <SheetHeader title="AI Prompt" onBack={() => setScreen('main')} onConfirm={() => setScreen('main')} />
          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
            <textarea
              autoFocus
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="输入 prompt，支持 {date} {taskTitle} {projectName} {lastOutput} 等占位符"
              rows={6}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none font-mono text-xs"
            />
            <CardSection>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex-1 text-sm text-gray-700">Agent</span>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {(['claude', 'codex'] as const).map(a => (
                    <button key={a} type="button" onClick={() => setAgent(a)}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${agent === a ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                      {a === 'claude' ? 'Claude' : 'Codex'}
                    </button>
                  ))}
                </div>
              </div>
              <RowDivider />
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex-1 text-sm text-gray-700">模型</span>
                <input value={model} onChange={e => setModel(e.target.value)} placeholder="默认"
                  className="text-sm text-right text-blue-500 placeholder-gray-300 focus:outline-none w-40" />
              </div>
            </CardSection>
          </div>
        </>
      )
    }

    if (screen === 'script') {
      return (
        <>
          <SheetHeader title="脚本" onBack={() => setScreen('main')} onConfirm={() => setScreen('main')} />
          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
            <input value={command} onChange={e => setCommand(e.target.value)}
              placeholder="Shell 命令，如 python3 ~/script.py"
              autoFocus
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono text-xs" />
            <input value={workDir} onChange={e => setWorkDir(e.target.value)}
              placeholder="工作目录（留空使用项目目录）"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
          </div>
        </>
      )
    }

    if (screen === 'http') {
      return (
        <>
          <SheetHeader title="HTTP" onBack={() => setScreen('main')} onConfirm={() => setScreen('main')} />
          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
                {(['GET', 'POST', 'PUT', 'DELETE'] as const).map(m => (
                  <button key={m} type="button" onClick={() => setHttpMethod(m)}
                    className={`px-2.5 py-2 text-xs font-medium transition-colors ${httpMethod === m ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {m}
                  </button>
                ))}
              </div>
              <input value={httpUrl} onChange={e => setHttpUrl(e.target.value)} placeholder="https://..."
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            {(httpMethod === 'POST' || httpMethod === 'PUT') && (
              <textarea value={httpBody} onChange={e => setHttpBody(e.target.value)}
                placeholder="请求体（JSON）" rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none font-mono text-xs" />
            )}
            <textarea value={httpHeaders} onChange={e => setHttpHeaders(e.target.value)}
              placeholder={'请求头（每行一个）\nAuthorization: Bearer token'}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none font-mono text-xs" />
          </div>
        </>
      )
    }

    if (screen === 'depends-on') {
      return (
        <>
          <SheetHeader title="前置任务" onBack={() => setScreen('main')} onConfirm={() => setScreen('main')} />
          <div className="overflow-y-auto flex-1">
            <CardSection>
              <button type="button" className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-gray-50"
                onClick={() => { setDependsOn(''); setScreen('main') }}>
                <span className="flex-1 text-sm text-gray-700">无</span>
                {!dependsOn && <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </button>
              {availableTasks.map((t) => (
                <div key={t.id}>
                  <RowDivider />
                  <button type="button" className="flex items-center gap-3 px-4 py-3.5 w-full text-left active:bg-gray-50"
                    onClick={() => { setDependsOn(t.id); setScreen('main') }}>
                    <span className="flex-1 text-sm text-gray-700">{t.title}</span>
                    {dependsOn === t.id && <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                </div>
              ))}
            </CardSection>
          </div>
        </>
      )
    }

    // ── Main screen ────────────────────────────────────────────────────────

    const recurPreset = cronToPreset(cron)
    const recurPresetLabel = PRESETS.find(p => p.value === recurPreset)?.label ?? '自定义'
    const recurTimeStr = `${String(recurringHour).padStart(2,'0')}:${String(recurringMinute).padStart(2,'0')}`

    return (
      <>
        <SheetHeader
          title={isEdit ? '编辑任务' : '新建任务'}
          onBack={onCancel}
          onConfirm={handleSubmit}
          confirmLabel={saving ? '保存中' : (isEdit ? '保存' : '创建')}
          confirmDisabled={saving}
          backLabel="取消"
        />
        <div className="overflow-y-auto flex-1">

          {/* Title + description */}
          <CardSection>
            <div className="px-4 py-3">
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="任务标题"
                className="w-full text-base font-medium text-gray-900 placeholder-gray-300 focus:outline-none"
              />
            </div>
            <RowDivider />
            <div className="px-4 py-3">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="备注（可选）"
                rows={1}
                className="w-full text-sm text-gray-600 placeholder-gray-300 focus:outline-none resize-none"
              />
            </div>
          </CardSection>

          {/* Assignee (create only) */}
          {!isEdit && (
            <CardSection>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span className="text-gray-400 flex-shrink-0 w-5 flex items-center justify-center">
                  <PersonIcon />
                </span>
                <span className="flex-1 text-sm text-gray-700">执行者</span>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {(['human', 'ai'] as TaskAssignee[]).map(a => (
                    <button key={a} type="button"
                      onClick={() => { setAssignee(a); if (a === 'human') setExecutorKind('none') }}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${assignee === a ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                      {a === 'human' ? '人类' : 'AI'}
                    </button>
                  ))}
                </div>
              </div>
            </CardSection>
          )}

          {/* Schedule */}
          <CardSection>
            <Row
              icon={<CalIcon />}
              label="触发方式"
              value={{ none: '手动', scheduled: '定时', recurring: '周期' }[scheduleKind]}
              onClick={() => setScreen('schedule-kind')}
            />

            {scheduleKind === 'scheduled' && (
              <>
                <RowDivider />
                <Row
                  icon={<CalIcon />}
                  label="日期"
                  value={scheduledDate ? new Date(scheduledDate + 'T12:00:00').toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' }) : '选择日期'}
                  accent={!!scheduledDate}
                  onClick={() => setScreen('scheduled-date')}
                />
                <RowDivider />
                <Row
                  icon={<ClockIcon />}
                  label="时间"
                  value={`${String(scheduledHour).padStart(2,'0')}:${String(scheduledMinute).padStart(2,'0')}`}
                  accent
                  onClick={() => setScreen('scheduled-time')}
                />
              </>
            )}

            {scheduleKind === 'recurring' && (
              <>
                <RowDivider />
                <Row
                  icon={<RepeatIcon />}
                  label="重复"
                  value={recurPreset === 'custom' ? cron : recurPresetLabel}
                  accent
                  onClick={() => setScreen('recurring-preset')}
                />
                {recurPreset !== 'hourly' && recurPreset !== 'custom' && (
                  <>
                    <RowDivider />
                    <Row
                      icon={<ClockIcon />}
                      label="执行时间"
                      value={recurTimeStr}
                      accent
                      onClick={() => setScreen('recurring-time')}
                    />
                  </>
                )}
                {recurPreset === 'custom' && (
                  <>
                    <RowDivider />
                    <div className="px-4 py-3 flex items-center gap-3">
                      <span className="text-gray-400 flex-shrink-0 w-5" />
                      <input value={cron} onChange={e => setCron(e.target.value)}
                        placeholder="0 9 * * *  （分 时 日 月 周）"
                        className="flex-1 text-sm font-mono text-blue-500 placeholder-gray-300 focus:outline-none" />
                    </div>
                  </>
                )}
              </>
            )}
          </CardSection>

          {/* Executor (AI only) */}
          {isAI && (
            <CardSection>
              <Row
                icon={<BoltIcon />}
                label="执行器"
                value={executorDisplay()}
                accent={executorKind !== 'none'}
                onClick={() => setScreen('executor-kind')}
              />
              {executorKind === 'ai_prompt' && (
                <>
                  <RowDivider />
                  <Row
                    icon={<ChatIcon />}
                    label={prompt ? prompt.slice(0, 28) + (prompt.length > 28 ? '…' : '') : '设置 Prompt'}
                    accent={!!prompt}
                    onClick={() => setScreen('prompt')}
                  />
                </>
              )}
              {executorKind === 'script' && (
                <>
                  <RowDivider />
                  <Row
                    icon={<TermIcon />}
                    label={command ? command.slice(0, 28) + (command.length > 28 ? '…' : '') : '配置脚本'}
                    accent={!!command}
                    onClick={() => setScreen('script')}
                  />
                </>
              )}
              {executorKind === 'http' && (
                <>
                  <RowDivider />
                  <Row
                    icon={<GlobeIcon />}
                    label={httpUrl ? `${httpMethod} ${httpUrl.slice(0, 20)}` : '配置 HTTP'}
                    accent={!!httpUrl}
                    onClick={() => setScreen('http')}
                  />
                </>
              )}
            </CardSection>
          )}

          {/* Options (AI executor) */}
          {isAI && executorKind !== 'none' && (
            <CardSection>
              {executorKind === 'ai_prompt' && (
                <>
                  <ToggleRow
                    icon={<HistoryIcon />}
                    label="接续上次对话"
                    checked={continueSession}
                    onChange={setContinueSession}
                  />
                  <RowDivider />
                </>
              )}
              <ToggleRow
                icon={<ReviewIcon />}
                label="完成后创建审核任务"
                checked={reviewOnComplete}
                onChange={setReviewOnComplete}
              />
            </CardSection>
          )}

          {/* Depends on */}
          {availableTasks.length > 0 && (
            <CardSection>
              <Row
                icon={<LinkIcon />}
                label="前置任务"
                value={dependsOnDisplay()}
                accent={!!dependsOn}
                onClick={() => setScreen('depends-on')}
              />
            </CardSection>
          )}

          {error && (
            <div className="mx-4 mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-500">
              {error}
            </div>
          )}

          <div className="h-6" />
        </div>
      </>
    )
  }

  // ── Shell ────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
        <div className="relative bg-gray-100 rounded-t-3xl flex flex-col max-h-[92vh] min-h-[50vh]">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-2.5 mb-1 flex-shrink-0" />
          {renderScreen()}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-100 rounded-2xl shadow-xl w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden">
        {renderScreen()}
      </div>
    </div>
  )
}

// ─── Sheet header ─────────────────────────────────────────────────────────────

function SheetHeader({
  title, onBack, onConfirm, confirmLabel = '完成', confirmDisabled = false, backLabel,
}: {
  title: string
  onBack: () => void
  onConfirm: () => void
  confirmLabel?: string
  confirmDisabled?: boolean
  backLabel?: string
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 bg-gray-100">
      <button type="button" onClick={onBack}
        className="text-sm text-gray-500 hover:text-gray-700 w-16 text-left">
        {backLabel ?? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        )}
      </button>
      <span className="text-sm font-semibold text-gray-800">{title}</span>
      <button type="button" onClick={onConfirm} disabled={confirmDisabled}
        className="text-sm font-semibold text-blue-500 hover:text-blue-600 disabled:opacity-40 w-16 text-right">
        {confirmLabel}
      </button>
    </div>
  )
}

// ─── Micro icons ──────────────────────────────────────────────────────────────

const CalIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" /></svg>
const ClockIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" /></svg>
const RepeatIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M17 1l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 13v2a4 4 0 01-4 4H3" strokeLinecap="round" /></svg>
const BoltIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" /></svg>
const ChatIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" /></svg>
const TermIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M8 9l3 3-3 3M13 15h3" strokeLinecap="round" strokeLinejoin="round" /></svg>
const GlobeIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="9" /><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" strokeLinecap="round" /></svg>
const LinkIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" strokeLinecap="round" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" strokeLinecap="round" /></svg>
const PersonIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="7" r="4" /><path d="M5.5 21a7 7 0 0113 0" strokeLinecap="round" /></svg>
const HistoryIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M3 12a9 9 0 109-9 9 9 0 00-9 9" strokeLinecap="round" /><path d="M3 3v6h6" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 7v5l3 3" strokeLinecap="round" /></svg>
const ReviewIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" /></svg>
