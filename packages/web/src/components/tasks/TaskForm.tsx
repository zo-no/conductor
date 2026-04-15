import { useState } from 'react'
import type { Task, TaskAssignee, TaskKind, TaskExecutor, ScheduleConfig } from '@conductor/types'
import { api } from '../../lib/api'

interface Props {
  projectId: string
  task?: Task           // if provided, edit mode
  onDone: () => void
  onCancel: () => void
}

type ExecutorKind = 'none' | 'ai_prompt' | 'script' | 'http'
type ScheduleKind = 'none' | 'scheduled' | 'recurring'

export function TaskForm({ projectId, task, onDone, onCancel }: Props) {
  const isEdit = !!task

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [assignee, setAssignee] = useState<TaskAssignee>(task?.assignee ?? 'human')
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? 'once')

  // Executor
  const initExKind: ExecutorKind = task?.executor?.kind ?? 'none'
  const [executorKind, setExecutorKind] = useState<ExecutorKind>(initExKind)
  const [prompt, setPrompt] = useState(task?.executor?.kind === 'ai_prompt' ? task.executor.prompt : '')
  const [model, setModel] = useState(task?.executor?.kind === 'ai_prompt' ? (task.executor.model ?? '') : '')
  const [command, setCommand] = useState(task?.executor?.kind === 'script' ? task.executor.command : '')
  const [workDir, setWorkDir] = useState(task?.executor?.kind === 'script' ? (task.executor.workDir ?? '') : '')
  const [httpUrl, setHttpUrl] = useState(task?.executor?.kind === 'http' ? task.executor.url : '')
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>(
    task?.executor?.kind === 'http' ? task.executor.method : 'GET'
  )
  const [httpBody, setHttpBody] = useState(task?.executor?.kind === 'http' ? (task.executor.body ?? '') : '')

  // Executor options
  const [includeLastOutput, setIncludeLastOutput] = useState(task?.executorOptions?.includeLastOutput ?? false)
  const [reviewOnComplete, setReviewOnComplete] = useState(task?.executorOptions?.reviewOnComplete ?? false)

  // Schedule
  const initSchedKind: ScheduleKind =
    task?.scheduleConfig?.kind === 'scheduled' ? 'scheduled'
    : task?.scheduleConfig?.kind === 'recurring' ? 'recurring'
    : 'none'
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>(initSchedKind)
  const [scheduledAt, setScheduledAt] = useState(
    task?.scheduleConfig?.kind === 'scheduled'
      ? task.scheduleConfig.scheduledAt.slice(0, 16)  // datetime-local format
      : ''
  )
  const [cron, setCron] = useState(
    task?.scheduleConfig?.kind === 'recurring' ? task.scheduleConfig.cron : ''
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function buildExecutor(): TaskExecutor | undefined {
    if (executorKind === 'ai_prompt') return { kind: 'ai_prompt', prompt, ...(model ? { model } : {}) }
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
    if (scheduleKind === 'recurring' && !cron.trim()) { setError('请输入 cron 表达式'); return }

    setSaving(true)
    setError('')
    try {
      const executor = buildExecutor()
      const scheduleConfig = buildScheduleConfig()
      const executorOptions = executor ? { includeLastOutput, reviewOnComplete } : undefined

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
          kind,
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

  // Sync kind when schedule changes
  function handleScheduleKindChange(sk: ScheduleKind) {
    setScheduleKind(sk)
    if (sk !== 'none' && kind === 'once') {
      setKind(sk === 'recurring' ? 'recurring' : 'scheduled')
    }
    if (sk === 'none') setKind('once')
  }

  const CRON_PRESETS = [
    { label: '每天 09:00', value: '0 9 * * *' },
    { label: '每小时', value: '0 * * * *' },
    { label: '每周一', value: '0 9 * * 1' },
    { label: '每月1号', value: '0 9 1 * *' },
  ]

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{isEdit ? '编辑任务' : '新建任务'}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-4">

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">标题 *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="任务标题"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">描述</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="可选描述"
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
              />
            </div>

            {/* Assignee + Kind (only on create) */}
            {!isEdit && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">执行者</label>
                  <select
                    value={assignee}
                    onChange={e => {
                      setAssignee(e.target.value as TaskAssignee)
                      if (e.target.value === 'human') setExecutorKind('none')
                    }}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="human">人类</option>
                    <option value="ai">AI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">触发方式</label>
                  <select
                    value={scheduleKind}
                    onChange={e => handleScheduleKindChange(e.target.value as ScheduleKind)}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="none">手动</option>
                    <option value="scheduled">定时</option>
                    <option value="recurring">周期</option>
                  </select>
                </div>
              </div>
            )}

            {/* Schedule config */}
            {scheduleKind === 'scheduled' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">执行时间 *</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            )}

            {scheduleKind === 'recurring' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cron 表达式 *</label>
                <input
                  value={cron}
                  onChange={e => setCron(e.target.value)}
                  placeholder="0 9 * * *"
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono"
                />
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {CRON_PRESETS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setCron(p.value)}
                      className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Executor (only for AI tasks) */}
            {(assignee === 'ai' || isEdit) && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">执行器</label>
                <select
                  value={executorKind}
                  onChange={e => setExecutorKind(e.target.value as ExecutorKind)}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 mb-3"
                >
                  <option value="none">无</option>
                  <option value="ai_prompt">AI Prompt</option>
                  <option value="script">Shell 脚本</option>
                  <option value="http">HTTP 请求</option>
                </select>

                {executorKind === 'ai_prompt' && (
                  <div className="space-y-2">
                    <textarea
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      placeholder="输入 prompt，支持 {date} {taskTitle} {projectName} {lastOutput} 等占位符"
                      rows={4}
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none font-mono text-xs"
                    />
                    <input
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      placeholder="模型（留空使用默认）"
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                )}

                {executorKind === 'script' && (
                  <div className="space-y-2">
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

                {executorKind === 'http' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={httpMethod}
                        onChange={e => setHttpMethod(e.target.value as any)}
                        className="text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      >
                        <option>GET</option>
                        <option>POST</option>
                        <option>PUT</option>
                        <option>DELETE</option>
                      </select>
                      <input
                        value={httpUrl}
                        onChange={e => setHttpUrl(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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

                {executorKind !== 'none' && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeLastOutput}
                        onChange={e => setIncludeLastOutput(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-xs text-gray-600">注入上次执行结果 <code className="text-gray-400">{'{lastOutput}'}</code></span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reviewOnComplete}
                        onChange={e => setReviewOnComplete(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-xs text-gray-600">执行完创建人类审核任务</span>
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
