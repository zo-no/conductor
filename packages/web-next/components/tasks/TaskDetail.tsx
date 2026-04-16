import { useEffect, useState } from 'react'
import type { Task, TaskLog, TaskOp } from '@conductor/types'
import type { TaskRun } from '../../lib/api'
import { api } from '../../lib/api'
import { useT } from '../../lib/i18n'
import { RunViewer } from './RunViewer'
import { ConfirmDialog } from '../ui/Dialog'

interface Props {
  task: Task
  allTasks: Task[]
  projectId: string
  onClose: () => void
  onRefresh: () => void
  onEdit: () => void
  onDeleted: () => void
}

export function TaskDetail({ task, allTasks, projectId, onClose, onRefresh, onEdit, onDeleted }: Props) {
  const t = useT()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [ops, setOps] = useState<TaskOp[]>([])
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [runs, setRuns] = useState<TaskRun[]>([])
  const [selectedRun, setSelectedRun] = useState<TaskRun | null>(null)
  const [tab, setTab] = useState<'info' | 'history' | 'ops'>(() =>
    task.assignee === 'ai' && task.status === 'running' ? 'history' : 'info'
  )
  const [toast, setToast] = useState<string | null>(null)

  // Auto-switch to history tab when task starts running
  useEffect(() => {
    if (task.assignee === 'ai' && task.status === 'running') {
      setTab('history')
    }
  }, [task.status, task.assignee])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    api.tasks.ops(task.id).then(setOps).catch(() => {})
    api.tasks.logs(task.id).then(setLogs).catch(() => {})
    if (task.assignee === 'ai') {
      api.tasks.runs(task.id).then(runs => {
        setRuns(runs)
        // Auto-open the latest running run
        const activeRun = runs.find(r => r.status === 'running')
        if (activeRun) setSelectedRun(activeRun)
      }).catch(() => {})
    }
  }, [task.id, task.updatedAt, task.assignee])

  const sourceTask = task.sourceTaskId ? allTasks.find(t => t.id === task.sourceTaskId) : null
  const blockedByTask = task.blockedByTaskId ? allTasks.find(t => t.id === task.blockedByTaskId) : null

  function statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: t('statusPending'),
      running: t('statusRunning'),
      done: t('statusDone'),
      failed: t('statusFailed'),
      cancelled: t('statusCancelled'),
      blocked: t('statusBlocked'),
    }
    return map[status] ?? status
  }

  function statusColor(status: string): string {
    const map: Record<string, string> = {
      pending: 'text-gray-400',
      running: 'text-green-600 font-medium',
      done: 'text-gray-400',
      failed: 'text-red-500',
      cancelled: 'text-gray-400',
      blocked: 'text-orange-500',
    }
    return map[status] ?? 'text-gray-400'
  }

  function opLabel(op: string): string {
    const map: Record<string, string> = {
      created: t('opCreated'),
      triggered: t('opTriggered'),
      status_changed: t('opStatusChanged'),
      done: t('opDone'),
      cancelled: t('opCancelled'),
      review_created: t('opReviewCreated'),
      unblocked: t('opUnblocked'),
      deleted: t('opDeleted'),
    }
    return map[op] ?? op
  }

  async function handleRun() {
    await api.tasks.run(task.id)
    onRefresh()
  }

  async function handleToggleEnabled() {
    await api.tasks.update(task.id, { enabled: !task.enabled })
    onRefresh()
  }

  async function handleDone() {
    await api.tasks.done(task.id)
    onRefresh()
    // Show feedback — find if any AI task depends on this human task
    const dependents = allTasks.filter(dep =>
      dep.dependsOn === task.id || dep.blockedByTaskId === task.id
    )
    if (dependents.length > 0) {
      const names = dependents.map(dep => `「${dep.title}」`).join('、')
      setToast(t('aiTriggered', names))
    } else {
      setToast(t('markedDone'))
    }
  }

  async function handleDelete() {
    setConfirmDelete(true)
  }

  async function handleDeleteConfirmed() {
    setConfirmDelete(false)
    await api.tasks.delete(task.id)
    onDeleted()
  }

  return (
    <>
    {confirmDelete && (
      <ConfirmDialog
        message={t('confirmDeleteTask', task.title)}
        confirmLabel={t('confirmDelete')}
        danger
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    <aside className="w-full flex-shrink-0 flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 leading-snug">{task.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs ${
              task.assignee === 'ai' ? 'text-gray-400' : 'text-gray-400'
            }`}>
              {task.assignee === 'ai' ? t('assigneeAI') : t('assigneeHuman')}
            </span>
            <span className="text-xs text-gray-400">{task.kind}</span>
            <span className={`text-xs ${statusColor(task.status)}`}>
              {statusLabel(task.status)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <button onClick={onEdit} className="text-gray-400 hover:text-gray-600 p-0.5" title={t('editTaskTitle')}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-0.5" title={t('cancel')}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mx-4 mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {(task.assignee === 'ai'
          ? ['info', 'history', 'ops'] as const
          : ['info', 'ops'] as const
        ).map(tabKey => (
          <button
            key={tabKey}
            onClick={() => { setTab(tabKey as any); setSelectedRun(null) }}
            className={`flex-1 py-2 text-xs font-medium ${
              tab === tabKey ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {{ info: t('tabInfo'), history: t('tabHistory'), ops: t('tabOps') }[tabKey]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* RunViewer overlay */}
        {tab === 'history' && selectedRun && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <RunViewer
              taskId={task.id}
              run={selectedRun}
              projectId={projectId}
              onBack={() => setSelectedRun(null)}
            />
          </div>
        )}

        {tab === 'history' && !selectedRun && (
          <div className="overflow-y-auto">
            {runs.length === 0 && logs.length === 0 && (
              <p className="text-sm text-gray-400 px-4 py-4">{t('noRuns')}</p>
            )}
            {/* Merge runs and logs by startedAt, runs take precedence */}
            {(() => {
              // Build a unified list: prefer run entries, supplement with log-only entries (skipped)
              const runIds = new Set(runs.map(r => r.startedAt))
              const logOnlyEntries = logs.filter(l => !runIds.has(l.startedAt))

              type Entry =
                | { kind: 'run'; run: typeof runs[0]; log: typeof logs[0] | undefined }
                | { kind: 'log'; log: typeof logs[0] }

              const entries: Entry[] = [
                ...runs.map(run => ({
                  kind: 'run' as const,
                  run,
                  log: logs.find(l => l.startedAt === run.startedAt),
                })),
                ...logOnlyEntries.map(log => ({ kind: 'log' as const, log })),
              ].sort((a, b) => {
                const aTime = a.kind === 'run' ? a.run.startedAt : a.log.startedAt
                const bTime = b.kind === 'run' ? b.run.startedAt : b.log.startedAt
                return new Date(bTime).getTime() - new Date(aTime).getTime()
              })

              return entries.map((entry) => {
                if (entry.kind === 'run') {
                  const { run, log } = entry
                  return (
                    <div key={run.id} className="border-b border-gray-50">
                      <button
                        onClick={() => setSelectedRun(run)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {run.status === 'running' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                            )}
                            <span className={`text-xs font-medium ${
                              run.status === 'done' ? 'text-green-600' :
                              run.status === 'failed' ? 'text-red-500' :
                              run.status === 'running' ? 'text-blue-600' : 'text-gray-400'
                            }`}>
                              {run.status === 'done' ? t('runDone') :
                               run.status === 'failed' ? t('runFailed') :
                               run.status === 'running' ? t('runRunning') : t('runCancelled')}
                            </span>
                            <span className="text-xs text-gray-300">{run.triggeredBy}</span>
                          </div>
                          <div className="text-right flex items-center gap-1.5">
                            <span className="text-xs text-gray-400">
                              {new Date(run.startedAt).toLocaleString('zh-CN', {
                                month: 'numeric', day: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                            {run.completedAt && (
                              <span className="text-xs text-gray-300">
                                {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
                              </span>
                            )}
                            <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                        {run.error && <p className="text-xs text-red-400 mt-0.5">{run.error}</p>}
                      </button>
                      {log?.output && (
                        <pre className="mx-4 mb-3 text-xs text-gray-500 bg-gray-50 rounded p-2 overflow-x-auto max-h-24 whitespace-pre-wrap">
                          {log.output.slice(0, 400)}{log.output.length > 400 ? '…' : ''}
                        </pre>
                      )}
                    </div>
                  )
                } else {
                  // log-only (skipped)
                  const { log } = entry
                  return (
                    <div key={log.id} className="px-4 py-3 border-b border-gray-50 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-orange-400 font-medium">跳过</span>
                        <span className="text-gray-400">
                          {new Date(log.startedAt).toLocaleString('zh-CN', {
                            month: 'numeric', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {log.skipReason && <p className="text-gray-400 mt-0.5">{log.skipReason}</p>}
                    </div>
                  )
                }
              })
            })()}
          </div>
        )}

        {tab === 'info' && (
          <div className="p-4 space-y-4">
            {task.description && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{t('description')}</label>
                <p className="mt-1 text-sm text-gray-700">{task.description}</p>
              </div>
            )}

            {task.dependsOn && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{t('dependsOnLabel')}</label>
                {(() => {
                  const dep = allTasks.find(d => d.id === task.dependsOn)
                  return dep
                    ? <p className="mt-1 text-sm text-blue-600">{dep.title}</p>
                    : <p className="mt-1 text-xs text-gray-400 font-mono">{task.dependsOn}</p>
                })()}
              </div>
            )}

            {task.waitingInstructions && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{t('waitingInstructions')}</label>
                <p className="mt-1 text-sm text-gray-700 bg-orange-50 rounded p-2">{task.waitingInstructions}</p>
              </div>
            )}

            {sourceTask && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{t('sourceTask')}</label>
                <p className="mt-1 text-sm text-blue-600">{sourceTask.title}</p>
              </div>
            )}

            {blockedByTask && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{t('waitingFor')}</label>
                <p className="mt-1 text-sm text-orange-600">{blockedByTask.title}</p>
              </div>
            )}

            {task.executor && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{t('executor')}</label>
                <p className="mt-1 text-xs text-gray-500 font-mono bg-gray-50 rounded p-2">
                  {task.executor.kind}
                  {task.executor.kind === 'ai_prompt' && (
                    <span className="block mt-1 text-gray-600 font-sans whitespace-pre-wrap">{task.executor.prompt}</span>
                  )}
                  {task.executor.kind === 'script' && (
                    <span className="block mt-1">{task.executor.command}</span>
                  )}
                  {task.executor.kind === 'http' && (
                    <span className="block mt-1">{task.executor.method} {task.executor.url}</span>
                  )}
                </p>
              </div>
            )}

            {task.scheduleConfig && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{t('schedule')}</label>
                <p className="mt-1 text-sm text-gray-700">
                  {task.scheduleConfig.kind === 'scheduled' && (
                    new Date(task.scheduleConfig.scheduledAt).toLocaleString('zh-CN')
                  )}
                  {task.scheduleConfig.kind === 'recurring' && (
                    <>
                      {task.scheduleConfig.cron}
                      {task.scheduleConfig.nextRunAt && (
                        <span className="text-gray-400 text-xs ml-2">
                          下次：{new Date(task.scheduleConfig.nextRunAt).toLocaleString('zh-CN')}
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
            )}

            {task.completionOutput && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{t('completionOutput')}</label>
                <p className="mt-1 text-sm text-gray-700 bg-gray-50 rounded p-2 whitespace-pre-wrap">{task.completionOutput}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'ops' && (
          <div className="overflow-y-auto">
            {ops.length === 0 && <p className="text-sm text-gray-400 px-4 py-4">{t('noOps')}</p>}
            {ops.map(op => (
              <div key={op.id} className="flex items-start gap-2 text-xs px-4 py-2.5 border-b border-gray-50">
                <span className="text-gray-400 flex-shrink-0 w-28">
                  {new Date(op.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-gray-600">
                  <span className="text-gray-400">[{op.actor}]</span>{' '}
                  {opLabel(op.op)}
                  {op.fromStatus && op.toStatus && (
                    <span className="text-gray-400"> {op.fromStatus} → {op.toStatus}</span>
                  )}
                  {op.note && <span className="text-gray-400"> · {op.note}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
        {/* Left: secondary — schedule toggle + delete */}
        <div className="flex items-center gap-3">
          {/* Schedule toggle — only for AI tasks that aren't terminal */}
          {task.assignee === 'ai' && task.status !== 'done' && task.status !== 'cancelled' && (
            <button
              onClick={handleToggleEnabled}
              className="flex items-center gap-1.5 group"
              title={task.enabled ? t('pauseSchedule') : t('resumeSchedule')}
            >
              <div className={[
                'relative w-8 h-4 rounded-full transition-colors duration-200',
                task.enabled ? 'bg-blue-500' : 'bg-gray-200',
              ].join(' ')}>
                <span className={[
                  'absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200',
                  task.enabled ? 'translate-x-4' : 'translate-x-0.5',
                ].join(' ')} />
              </div>
            </button>
          )}

          {/* Delete — low-key */}
          <button
            onClick={handleDelete}
            title={t('delete')}
            className="text-gray-300 hover:text-red-400 transition-colors p-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Right: primary action */}
        <div className="flex items-center">
          {/* Human pending: done */}
          {task.assignee === 'human' && task.status === 'pending' && (
            <button
              onClick={handleDone}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 active:scale-95 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {t('markDone')}
            </button>
          )}

          {/* AI running: pulse indicator */}
          {task.assignee === 'ai' && task.status === 'running' && (
            <span className="flex items-center gap-2 text-xs text-green-600">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              {t('statusRunning')}
            </span>
          )}

          {/* AI triggerable: run */}
          {task.assignee === 'ai' && (task.status === 'pending' || task.status === 'failed' || task.status === 'cancelled') && (
            <button
              onClick={handleRun}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 active:scale-95 transition-all"
            >
              <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {task.status === 'failed' ? t('retry') : t('run')}
            </button>
          )}
        </div>
      </div>
    </aside>
    </>
  )
}
