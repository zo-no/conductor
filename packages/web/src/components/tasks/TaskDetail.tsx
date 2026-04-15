import { useEffect, useState } from 'react'
import type { Task, TaskLog, TaskOp } from '@conductor/types'
import type { TaskRun } from '../../lib/api'
import { api } from '../../lib/api'
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [ops, setOps] = useState<TaskOp[]>([])
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [runs, setRuns] = useState<TaskRun[]>([])
  const [selectedRun, setSelectedRun] = useState<TaskRun | null>(null)
  const [tab, setTab] = useState<'info' | 'runs' | 'logs' | 'ops'>('info')

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
  }

  async function handleCancel() {
    await api.tasks.cancel(task.id)
    onRefresh()
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
        message={`确定删除任务「${task.title}」？`}
        confirmLabel="删除"
        danger
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDelete(false)}
      />
    )}
    <aside className="w-80 flex-shrink-0 border-l border-gray-100 flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 leading-snug">{task.title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              task.assignee === 'ai' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
            }`}>
              {task.assignee === 'ai' ? 'AI' : '人类'}
            </span>
            <span className="text-xs text-gray-400">{task.kind}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor(task.status)}`}>
              {statusLabel(task.status)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <button onClick={onEdit} className="text-gray-400 hover:text-gray-600 p-0.5" title="编辑">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-0.5" title="关闭">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {(task.assignee === 'ai'
          ? ['info', 'runs', 'logs', 'ops'] as const
          : ['info', 'logs', 'ops'] as const
        ).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t as any); setSelectedRun(null) }}
            className={`flex-1 py-2 text-xs font-medium ${
              tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {{ info: '详情', runs: '执行', logs: '日志', ops: '记录' }[t]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* RunViewer overlay */}
        {tab === 'runs' && selectedRun && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <RunViewer
              taskId={task.id}
              run={selectedRun}
              projectId={projectId}
              onBack={() => setSelectedRun(null)}
            />
          </div>
        )}

        {tab === 'runs' && !selectedRun && (
          <div className="overflow-y-auto">
            {runs.length === 0 && <p className="text-sm text-gray-400 px-4 py-4">暂无执行记录</p>}
            {runs.map(run => (
              <button
                key={run.id}
                onClick={() => setSelectedRun(run)}
                className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors"
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
                      {run.status === 'done' ? '✓ 完成' :
                       run.status === 'failed' ? '✗ 失败' :
                       run.status === 'running' ? '执行中' : '已取消'}
                    </span>
                    <span className="text-xs text-gray-300">{run.triggeredBy}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">
                      {new Date(run.startedAt).toLocaleString('zh-CN', {
                        month: 'numeric', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {run.completedAt && (
                      <span className="text-xs text-gray-300 ml-1.5">
                        {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
                      </span>
                    )}
                  </div>
                </div>
                {run.error && <p className="text-xs text-red-400 mt-0.5">{run.error}</p>}
              </button>
            ))}
          </div>
        )}

        {tab === 'info' && (
          <div className="p-4 space-y-4">
            {task.description && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">描述</label>
                <p className="mt-1 text-sm text-gray-700">{task.description}</p>
              </div>
            )}

            {task.dependsOn && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">前置任务</label>
                {(() => {
                  const dep = allTasks.find(t => t.id === task.dependsOn)
                  return dep
                    ? <p className="mt-1 text-sm text-blue-600">{dep.title}</p>
                    : <p className="mt-1 text-xs text-gray-400 font-mono">{task.dependsOn}</p>
                })()}
              </div>
            )}

            {task.waitingInstructions && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">完成说明</label>
                <p className="mt-1 text-sm text-gray-700 bg-orange-50 rounded p-2">{task.waitingInstructions}</p>
              </div>
            )}

            {sourceTask && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">来源任务</label>
                <p className="mt-1 text-sm text-blue-600">{sourceTask.title}</p>
              </div>
            )}

            {blockedByTask && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">等待</label>
                <p className="mt-1 text-sm text-orange-600">{blockedByTask.title}</p>
              </div>
            )}

            {task.executor && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">执行器</label>
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
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">调度</label>
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
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">完成输出</label>
                <p className="mt-1 text-sm text-gray-700 bg-gray-50 rounded p-2 whitespace-pre-wrap">{task.completionOutput}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'logs' && (
          <div className="overflow-y-auto">
            {logs.length === 0 && <p className="text-sm text-gray-400 px-4 py-4">暂无执行日志</p>}
            {logs.map(log => (
              <div key={log.id} className="text-xs px-4 py-3 border-b border-gray-50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${
                    log.status === 'success' ? 'text-green-600' :
                    log.status === 'failed' ? 'text-red-500' :
                    log.status === 'skipped' ? 'text-orange-400' : 'text-gray-400'
                  }`}>
                    {log.status === 'success' ? '✓ 成功' :
                     log.status === 'failed' ? '✗ 失败' :
                     log.status === 'skipped' ? '跳过' : '取消'}
                  </span>
                  <div className="text-gray-400 text-right">
                    <span>{new Date(log.startedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    {log.completedAt && (
                      <span className="ml-1 text-gray-300">
                        {Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)}s
                      </span>
                    )}
                  </div>
                </div>
                {log.skipReason && <p className="text-gray-400">{log.skipReason}</p>}
                {log.error && <p className="text-red-500">{log.error}</p>}
                {log.output && (
                  <pre className="text-gray-600 bg-gray-50 rounded p-1.5 overflow-x-auto max-h-28 text-xs whitespace-pre-wrap">
                    {log.output.slice(0, 500)}{log.output.length > 500 ? '…' : ''}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'ops' && (
          <div className="overflow-y-auto">
            {ops.length === 0 && <p className="text-sm text-gray-400 px-4 py-4">暂无操作记录</p>}
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
      <div className="p-3 border-t border-gray-100 space-y-2">
        <div className="flex gap-2">
          {task.assignee === 'human' && task.status === 'pending' && (
            <button
              onClick={handleDone}
              className="flex-1 py-2 text-xs font-medium bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            >
              标记完成
            </button>
          )}
          {task.assignee === 'ai' && (task.status === 'pending' || task.status === 'failed' || task.status === 'cancelled') && (
            <button
              onClick={handleRun}
              className="flex-1 py-2 text-xs font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              {task.status === 'failed' ? '重试' : '立即触发'}
            </button>
          )}
          {(task.status === 'pending' || task.status === 'running') && (
            <button
              onClick={handleCancel}
              className="flex-1 py-2 text-xs font-medium border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {task.assignee === 'ai' && task.status !== 'done' && task.status !== 'cancelled' && (
            <button
              onClick={handleToggleEnabled}
              className="flex-1 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {task.enabled ? '暂停调度' : '恢复调度'}
            </button>
          )}
          <button
            onClick={handleDelete}
            className="py-1.5 px-3 text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </aside>
    </>
  )
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待执行', running: '执行中', done: '完成',
    failed: '失败', cancelled: '已取消', blocked: '等待中',
  }
  return map[status] ?? status
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-500',
    running: 'bg-green-50 text-green-600',
    done: 'bg-gray-100 text-gray-400',
    failed: 'bg-red-50 text-red-500',
    cancelled: 'bg-gray-100 text-gray-400',
    blocked: 'bg-orange-50 text-orange-500',
  }
  return map[status] ?? 'bg-gray-100 text-gray-500'
}

function opLabel(op: string): string {
  const map: Record<string, string> = {
    created: '创建', triggered: '触发', status_changed: '状态变更',
    done: '完成', cancelled: '取消', review_created: '创建审核任务',
    unblocked: '解除阻塞', deleted: '删除',
  }
  return map[op] ?? op
}
