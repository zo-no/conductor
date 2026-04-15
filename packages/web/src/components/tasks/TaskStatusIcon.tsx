import type { Task } from '@conductor/types'

interface Props {
  task: Task
  onClick?: () => void
}

export function TaskStatusIcon({ task, onClick }: Props) {
  const { status, assignee } = task

  if (assignee === 'human') {
    if (status === 'done') {
      return (
        <button className="w-5 h-5 rounded-full border-2 border-gray-300 bg-gray-100 flex items-center justify-center flex-shrink-0" disabled>
          <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      )
    }
    if (status === 'cancelled') {
      return (
        <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0 opacity-40" />
      )
    }
    // pending — red, clickable
    return (
      <button
        onClick={onClick}
        className="w-5 h-5 rounded-full border-2 border-red-400 hover:bg-red-50 flex-shrink-0 transition-colors"
        title="标记完成"
      />
    )
  }

  // AI tasks
  if (status === 'running') {
    return (
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
      </div>
    )
  }

  if (status === 'blocked') {
    return (
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-orange-400" title="等待人类处理">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-red-500">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-gray-300">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )
  }

  if (status === 'cancelled') {
    return (
      <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0 opacity-40" />
    )
  }

  // pending
  return (
    <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
  )
}
