import type { Task } from '@conductor/types'
import { TaskStatusIcon } from './TaskStatusIcon'
import { getTaskTimeDisplay } from '../../lib/timeline'
import { api } from '../../lib/api'

interface Props {
  task: Task
  blockedByTasks?: Task[]   // human tasks blocking this AI task
  onSelect: (task: Task) => void
  onRefresh: () => void
  isSelected: boolean
  indent?: boolean
  selectMode?: boolean
  isChecked?: boolean
  onToggleSelect?: (taskId: string) => void
}

export function TaskRow({ task, blockedByTasks, onSelect, onRefresh, isSelected, indent, selectMode, isChecked, onToggleSelect }: Props) {
  const isDone = task.status === 'done' || task.status === 'cancelled'
  const isHumanPending = task.assignee === 'human' && task.status === 'pending'
  const timeDisplay = getTaskTimeDisplay(task)

  async function handleCheck() {
    await api.tasks.done(task.id)
    onRefresh()
  }

  return (
    <div className={indent ? 'ml-7' : ''}>
      <div
        className={[
          'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer group',
          isSelected && !selectMode ? 'bg-blue-50' : '',
          selectMode && isChecked ? 'bg-blue-50' : '',
          !isSelected && !isChecked ? 'hover:bg-gray-50' : '',
          isDone ? 'opacity-50' : '',
        ].join(' ')}
        onClick={() => selectMode ? onToggleSelect?.(task.id) : onSelect(task)}
      >
        {selectMode && (
          <input
            type="checkbox"
            checked={isChecked ?? false}
            onChange={() => onToggleSelect?.(task.id)}
            onClick={e => e.stopPropagation()}
            className="w-4 h-4 rounded border-gray-300 text-blue-500 flex-shrink-0"
          />
        )}
        <div onClick={e => e.stopPropagation()}>
          <TaskStatusIcon
            task={task}
            onClick={task.assignee === 'human' && task.status === 'pending'
              ? () => handleCheck()
              : undefined
            }
          />
        </div>

        <div className="flex-1 min-w-0">
          <span className={[
            'text-sm truncate block',
            isDone ? 'line-through text-gray-400' : '',
            isHumanPending ? 'text-gray-900 font-medium' : 'text-gray-700',
          ].join(' ')}>
            {task.title}
          </span>
          {task.assignee === 'ai' && (
            <span className="text-xs text-gray-400">AI</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {timeDisplay && (
            <span className={[
              'text-xs',
              isHumanPending ? 'text-red-500 font-medium' : 'text-gray-400',
            ].join(' ')}>
              {timeDisplay}
            </span>
          )}
          {task.kind === 'recurring' && (
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {!task.enabled && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">已暂停</span>
          )}
        </div>
      </div>

      {/* Blocked-by human tasks inlined below */}
      {blockedByTasks && blockedByTasks.length > 0 && (
        <div className="ml-8 border-l-2 border-orange-200 pl-3 mt-0.5 mb-1 space-y-0.5">
          {blockedByTasks.map(ht => (
            <TaskRow
              key={ht.id}
              task={ht}
              onSelect={onSelect}
              onRefresh={onRefresh}
              isSelected={isSelected}
              indent={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}
