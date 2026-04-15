import { useState } from 'react'
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

// ─── Segment control ──────────────────────────────────────────────────────────

function SegmentControl<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string; icon?: React.ReactNode; desc?: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            'flex-1 flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg border text-xs font-medium transition-colors',
            value === opt.value
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
          ].join(' ')}
        >
          {opt.icon && <span className="text-base leading-none">{opt.icon}</span>}
          <span>{opt.label}</span>
          {opt.desc && <span className={`text-[10px] font-normal ${value === opt.value ? 'text-blue-500' : 'text-gray-400'}`}>{opt.desc}</span>}
        </button>
      ))}
    </div>
  )
}

// ─── Human-friendly recurring picker ─────────────────────────────────────────

type RecurringPreset = 'daily' | 'weekday' | 'weekly' | 'monthly' | 'hourly' | 'custom'

const RECURRING_PRESETS: { value: RecurringPreset; label: string; cron: string }[] = [
  { value: 'daily',   label: '每天',   cron: '0 9 * * *' },
  { value: 'weekday', label: '工作日', cron: '0 9 * * 1-5' },
  { value: 'weekly',  label: '每周一', cron: '0 9 * * 1' },
  { value: 'monthly', label: '每月1日', cron: '0 9 1 * *' },
  { value: 'hourly',  label: '每小时', cron: '0 * * * *' },
  { value: 'custom',  label: '自定义', cron: '' },
]

function cronToPreset(cron: string): RecurringPreset {
  const match = RECURRING_PRESETS.find(p => p.value !== 'custom' && p.cron === cron)
  return match ? match.value : 'custom'
}

function RecurringPicker({ cron, onChange }: { cron: string; onChange: (c: string) => void }) {
  const preset = cronToPreset(cron)
  const [hour, setHour] = useState(() => {
    const parts = cron.split(' ')
    const h = parseInt(parts[1] ?? '9')
    return isNaN(h) ? 9 : h
  })

  function handlePreset(p: RecurringPreset) {
    const found = RECURRING_PRESETS.find(x => x.value === p)
    if (found && p !== 'custom') {
      // Replace hour in the preset cron
      const parts = found.cron.split(' ')
      parts[1] = String(hour)
      onChange(parts.join(' '))
    }
  }

  function handleHourChange(h: number) {
    setHour(h)
    if (preset !== 'custom') {
      const found = RECURRING_PRESETS.find(x => x.value === preset)
      if (found) {
        const parts = found.cron.split(' ')
        parts[1] = String(h)
        onChange(parts.join(' '))
      }
    }
  }

  return (
    <div className="space-y-3">
      {/* Preset grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {RECURRING_PRESETS.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => handlePreset(p.value)}
            className={[
              'py-1.5 px-2 rounded-md text-xs font-medium border transition-colors',
              preset === p.value
                ? 'border-blue-400 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:border-gray-300',
            ].join(' ')}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Hour picker (for non-hourly, non-custom) */}
      {preset !== 'hourly' && preset !== 'custom' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">执行时间</span>
          <div className="flex flex-wrap gap-1">
            {[6, 7, 8, 9, 10, 12, 14, 18, 20, 22].map(h => (
              <button
                key={h}
                type="button"
                onClick={() => handleHourChange(h)}
                className={[
                  'w-9 py-0.5 rounded text-xs border transition-colors',
                  hour === h
                    ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300',
                ].join(' ')}
              >
                {h}:00
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom cron */}
      {preset === 'custom' && (
        <div>
          <input
            value={cron}
            onChange={e => onChange(e.target.value)}
            placeholder="0 9 * * *  （分 时 日 月 周）"
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono text-xs"
          />
          <p className="text-[10px] text-gray-400 mt-1">标准 5 字段 cron 表达式</p>
        </div>
      )}
    </div>
  )
}

// ─── Human-friendly scheduled time picker ────────────────────────────────────

function ScheduledPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const now = new Date()

  function quickOption(label: string, getDate: () => Date) {
    const d = getDate()
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:00`
    const isSelected = value === iso
    return (
      <button
        key={label}
        type="button"
        onClick={() => onChange(iso)}
        className={[
          'py-1.5 px-2.5 rounded-md text-xs border transition-colors',
          isSelected
            ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
            : 'border-gray-200 text-gray-500 hover:border-gray-300',
        ].join(' ')}
      >
        {label}
      </button>
    )
  }

  const todayAt = (h: number) => {
    const d = new Date(now); d.setHours(h, 0, 0, 0); return d
  }
  const tomorrowAt = (h: number) => {
    const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0); return d
  }
  const nextMondayAt = (h: number) => {
    const d = new Date(now)
    const day = d.getDay()
    const diff = day === 0 ? 1 : 8 - day
    d.setDate(d.getDate() + diff); d.setHours(h, 0, 0, 0); return d
  }

  const quickOptions = [
    { label: '今天下午', date: () => todayAt(14) },
    { label: '今天晚上', date: () => todayAt(20) },
    { label: '明天早上', date: () => tomorrowAt(9) },
    { label: '明天下午', date: () => tomorrowAt(14) },
    { label: '下周一', date: () => nextMondayAt(9) },
  ].filter(opt => opt.date() > now)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {quickOptions.map(opt => quickOption(opt.label, opt.date))}
      </div>
      <input
        type="datetime-local"
        value={value}
        onChange={e => onChange(e.target.value)}
        min={now.toISOString().slice(0, 16)}
        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      />
    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function TaskForm({ projectId, task, onDone, onCancel }: Props) {
  const isEdit = !!task

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [assignee, setAssignee] = useState<TaskAssignee>(task?.assignee ?? 'human')

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
    task?.executor?.kind === 'http' ? task.executor.method : 'GET'
  )
  const [httpBody, setHttpBody] = useState(task?.executor?.kind === 'http' ? (task.executor.body ?? '') : '')

  // Executor options
  const [continueSession, setContinueSession] = useState(task?.executorOptions?.continueSession ?? false)
  const [reviewOnComplete, setReviewOnComplete] = useState(task?.executorOptions?.reviewOnComplete ?? false)

  // Schedule
  const initSchedKind: ScheduleKind =
    task?.scheduleConfig?.kind === 'scheduled' ? 'scheduled'
    : task?.scheduleConfig?.kind === 'recurring' ? 'recurring'
    : 'none'
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>(initSchedKind)
  const [scheduledAt, setScheduledAt] = useState(
    task?.scheduleConfig?.kind === 'scheduled'
      ? task.scheduleConfig.scheduledAt.slice(0, 16)
      : ''
  )
  const [cron, setCron] = useState(
    task?.scheduleConfig?.kind === 'recurring' ? task.scheduleConfig.cron : '0 9 * * *'
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function buildExecutor(): TaskExecutor | undefined {
    if (executorKind === 'ai_prompt') return { kind: 'ai_prompt', prompt, agent, ...(model ? { model } : {}) }
    if (executorKind === 'script') return { kind: 'script', command, ...(workDir ? { workDir } : {}) }
    if (executorKind === 'http') return { kind: 'http', url: httpUrl, method: httpMethod, ...(httpBody ? { body: httpBody } : {}) }
    return undefined
  }

  function buildScheduleConfig(): ScheduleConfig | undefined {
    if (scheduleKind === 'scheduled' && scheduledAt) {
      return { kind: 'scheduled', scheduledAt: new Date(scheduledAt).toISOString() }
    }
    if (scheduleKind === 'recurring' && cron) {
      const existing = task?.scheduleConfig?.kind === 'recurring' ? task.scheduleConfig : {}
      return { kind: 'recurring', cron, ...(existing as any) }
    }
    return undefined
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('标题不能为空'); return }
    if (executorKind === 'ai_prompt' && !prompt.trim()) { setError('prompt 不能为空'); return }
    if (executorKind === 'script' && !command.trim()) { setError('命令不能为空'); return }
    if (executorKind === 'http' && !httpUrl.trim()) { setError('URL 不能为空'); return }
    if (scheduleKind === 'scheduled' && !scheduledAt) { setError('请选择执行时间'); return }
    if (scheduleKind === 'recurring' && !cron.trim()) { setError('请输入执行周期'); return }

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
        })
      }
      onDone()
    } catch (e: any) {
      setError(e.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  function handleAssigneeChange(a: TaskAssignee) {
    setAssignee(a)
    if (a === 'human') setExecutorKind('none')
  }

  const isAI = assignee === 'ai' || isEdit

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">{isEdit ? '编辑任务' : '新建任务'}</h2>
          <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-5">

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">标题 *</label>
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="任务标题"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">描述</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="可选描述"
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
              />
            </div>

            {/* Assignee — segment control (create only) */}
            {!isEdit && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">执行者</label>
                <SegmentControl
                  value={assignee}
                  onChange={handleAssigneeChange}
                  options={[
                    { value: 'human', label: '人类', icon: '👤', desc: '手动完成' },
                    { value: 'ai',    label: 'AI',   icon: '🤖', desc: '自动执行' },
                  ]}
                />
              </div>
            )}

            {/* Schedule — segment control */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">触发方式</label>
              <SegmentControl
                value={scheduleKind}
                onChange={setScheduleKind}
                options={[
                  { value: 'none',      label: '手动',   icon: '▶', desc: '按需触发' },
                  { value: 'scheduled', label: '定时',   icon: '🕐', desc: '指定时间' },
                  { value: 'recurring', label: '周期',   icon: '🔁', desc: '重复执行' },
                ]}
              />
            </div>

            {/* Scheduled time */}
            {scheduleKind === 'scheduled' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">执行时间 *</label>
                <ScheduledPicker value={scheduledAt} onChange={setScheduledAt} />
              </div>
            )}

            {/* Recurring config */}
            {scheduleKind === 'recurring' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">执行周期 *</label>
                <RecurringPicker cron={cron} onChange={setCron} />
              </div>
            )}

            {/* Executor type — segment control (AI only) */}
            {isAI && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">执行器</label>
                <SegmentControl
                  value={executorKind}
                  onChange={setExecutorKind}
                  options={[
                    { value: 'none',     label: '无',      icon: '—' },
                    { value: 'ai_prompt',label: 'AI Prompt', icon: '💬' },
                    { value: 'script',   label: '脚本',    icon: '⌨' },
                    { value: 'http',     label: 'HTTP',    icon: '🌐' },
                  ]}
                />

                {/* AI Prompt config */}
                {executorKind === 'ai_prompt' && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      placeholder="输入 prompt，支持 {date} {taskTitle} {projectName} {lastOutput} 等占位符"
                      rows={4}
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none font-mono text-xs"
                    />
                    <div className="flex gap-2">
                      {/* Agent selector */}
                      <div className="flex rounded-md border border-gray-200 overflow-hidden flex-shrink-0">
                        {(['claude', 'codex'] as const).map(a => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setAgent(a)}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                              agent === a ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {a === 'claude' ? 'Claude' : 'Codex'}
                          </button>
                        ))}
                      </div>
                      <input
                        value={model}
                        onChange={e => setModel(e.target.value)}
                        placeholder="模型（留空默认）"
                        className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                  </div>
                )}

                {/* Script config */}
                {executorKind === 'script' && (
                  <div className="mt-3 space-y-2">
                    <input
                      value={command}
                      onChange={e => setCommand(e.target.value)}
                      placeholder="Shell 命令，如 python3 ~/script.py"
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono text-xs"
                    />
                    <input
                      value={workDir}
                      onChange={e => setWorkDir(e.target.value)}
                      placeholder="工作目录（留空使用项目目录）"
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                )}

                {/* HTTP config */}
                {executorKind === 'http' && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <div className="flex rounded-md border border-gray-200 overflow-hidden flex-shrink-0">
                        {(['GET', 'POST', 'PUT', 'DELETE'] as const).map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setHttpMethod(m)}
                            className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                              httpMethod === m ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                      <input
                        value={httpUrl}
                        onChange={e => setHttpUrl(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                    {(httpMethod === 'POST' || httpMethod === 'PUT') && (
                      <textarea
                        value={httpBody}
                        onChange={e => setHttpBody(e.target.value)}
                        placeholder='请求体（JSON）'
                        rows={3}
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none font-mono text-xs"
                      />
                    )}
                  </div>
                )}

                {/* Executor options */}
                {executorKind !== 'none' && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    {executorKind === 'ai_prompt' && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={continueSession}
                          onChange={e => setContinueSession(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-xs text-gray-600">接续上次对话</span>
                      </label>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={reviewOnComplete}
                        onChange={e => setReviewOnComplete(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-600">完成后创建人工审核任务</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded px-3 py-2">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? '保存中...' : (isEdit ? '保存' : '创建')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
