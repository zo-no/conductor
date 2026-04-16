import { useState } from 'react'
import type { Project, Task } from '@conductor/types'
import { groupTasksForTimeline } from '../../lib/timeline'
import { TaskRow } from './TaskRow'
import { useT } from '../../lib/i18n'

interface Props {
  tasks: Task[]
  projects?: Project[]   // when provided, render grouped by project (all-projects view)
  assigneeFilter?: 'human' | 'ai'
  onSelect: (task: Task) => void
  onRefresh: () => void
  selectedTaskId?: string
  // bulk select
  selectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (taskId: string) => void
}

export function Timeline({ tasks, projects, assigneeFilter, onSelect, onRefresh, selectedTaskId, selectMode, selectedIds, onToggleSelect }: Props) {
  const t = useT()
  const [recurringExpanded, setRecurringExpanded] = useState(true)
  const [doneExpanded, setDoneExpanded] = useState(false)

  // All-projects mode: render one Timeline section per project
  if (projects) {
    const activeProjects = projects.filter(p => !p.archived && p.createdBy !== 'system')
    return (
      <div className="space-y-8">
        {activeProjects.map(project => {
          const projectTasks = tasks.filter(t => t.projectId === project.id)
          if (projectTasks.length === 0) return null
          const pendingCount = projectTasks.filter(t => t.status === 'pending' || t.status === 'running' || t.status === 'blocked').length
          return (
            <div key={project.id}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">{project.name}</h3>
                {pendingCount > 0 && (
                  <span className="text-xs text-gray-400">{t('pendingN', pendingCount)}</span>
                )}
              </div>
              <Timeline
                tasks={projectTasks}
                onSelect={onSelect}
                onRefresh={onRefresh}
                selectedTaskId={selectedTaskId}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
              />
            </div>
          )
        })}
      </div>
    )
  }

  const groups = groupTasksForTimeline(tasks, assigneeFilter)

  // Build a map of taskId -> blocked human tasks for inline display
  const blockedMap = new Map<string, Task[]>()
  for (const task of tasks) {
    if (task.status === 'blocked' && task.blockedByTaskId) {
      const humanTask = tasks.find(t => t.id === task.blockedByTaskId)
      if (humanTask) {
        if (!blockedMap.has(task.id)) blockedMap.set(task.id, [])
        blockedMap.get(task.id)!.push(humanTask)
      }
    }
  }

  // Human tasks that are "owned" by a blocked AI task — hide from top level
  const inlinedHumanTaskIds = new Set(
    [...blockedMap.values()].flat().map(t => t.id)
  )

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <svg className="w-10 h-10 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span className="text-sm text-gray-400">{t('noTasks')}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        if (group.kind === 'date') {
          const visibleTasks = group.tasks.filter(t => !inlinedHumanTaskIds.has(t.id))
          if (visibleTasks.length === 0) return null
          const isToday = group.label === t('today')
          return (
            <section key={group.label}>
              <h3 className={`text-xs font-semibold px-3 mb-2 ${
                isToday ? 'text-gray-700' : 'text-gray-400 uppercase tracking-wider'
              }`}>
                {group.label}
              </h3>
              <div className="space-y-0.5">
                {visibleTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    blockedByTasks={blockedMap.get(task.id)}
                    onSelect={onSelect}
                    onRefresh={onRefresh}
                    isSelected={selectedTaskId === task.id}
                    selectMode={selectMode}
                    isChecked={selectedIds?.has(task.id) ?? false}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
              </div>
            </section>
          )
        }

        if (group.kind === 'recurring') {
          return (
            <section key="recurring">
              <button
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1 hover:text-gray-600"
                onClick={() => setRecurringExpanded(v => !v)}
              >
                <svg
                  className={`w-3 h-3 transition-transform ${recurringExpanded ? 'rotate-90' : ''}`}
                  fill="currentColor" viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                {t('recurring')}
                <span className="text-gray-300 font-normal normal-case tracking-normal">
                  ({group.tasks.length})
                </span>
              </button>
              {recurringExpanded && (
                <div className="space-y-0.5">
                  {group.tasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onSelect={onSelect}
                      onRefresh={onRefresh}
                      isSelected={selectedTaskId === task.id}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        }

        if (group.kind === 'no_time') {
          const visibleTasks = group.tasks.filter(t => !inlinedHumanTaskIds.has(t.id))
          if (visibleTasks.length === 0) return null
          return (
            <section key="no_time">
              <h3 className="text-xs text-gray-300 px-3 mb-1">
                {t('noTime')}
              </h3>
              <div className="space-y-0.5">
                {visibleTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    blockedByTasks={blockedMap.get(task.id)}
                    onSelect={onSelect}
                    onRefresh={onRefresh}
                    isSelected={selectedTaskId === task.id}
                    selectMode={selectMode}
                    isChecked={selectedIds?.has(task.id) ?? false}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
              </div>
            </section>
          )
        }

        if (group.kind === 'done') {
          return (
            <section key="done">
              <button
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1 hover:text-gray-600"
                onClick={() => setDoneExpanded(v => !v)}
              >
                <svg
                  className={`w-3 h-3 transition-transform ${doneExpanded ? 'rotate-90' : ''}`}
                  fill="currentColor" viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                {t('done')}
                <span className="text-gray-300 font-normal normal-case tracking-normal">
                  ({group.tasks.length})
                </span>
              </button>
              {doneExpanded && (
                <div className="space-y-0.5">
                  {group.tasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onSelect={onSelect}
                      onRefresh={onRefresh}
                      isSelected={selectedTaskId === task.id}
                    />
                  ))}
                </div>
              )}
            </section>
          )
        }

        return null
      })}
    </div>
  )
}
