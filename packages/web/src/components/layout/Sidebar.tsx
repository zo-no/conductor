import type { Project, Task } from '@conductor/types'

interface Props {
  projects: Project[]
  selectedProjectId: string | null
  tasks: Task[]
  onSelect: (projectId: string) => void
  onNewProject: () => void
  onSettings: (project: Project) => void
}

export function Sidebar({ projects, selectedProjectId, tasks, onSelect, onNewProject, onSettings }: Props) {
  // Count pending human tasks per project
  const pendingByProject = new Map<string, number>()
  for (const task of tasks) {
    if (task.assignee === 'human' && task.status === 'pending') {
      pendingByProject.set(task.projectId, (pendingByProject.get(task.projectId) ?? 0) + 1)
    }
  }

  const active = projects.filter(p => !p.archived)
  const archived = projects.filter(p => p.archived)

  return (
    <aside className="w-56 flex-shrink-0 border-r border-gray-100 flex flex-col h-full bg-gray-50">
      <div className="px-4 py-4 border-b border-gray-100">
        <h1 className="text-sm font-semibold text-gray-800 tracking-tight">Conductor</h1>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <div className="px-3 mb-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">我的项目</span>
        </div>

        {active.map(project => {
          const pending = pendingByProject.get(project.id) ?? 0
          const isSelected = selectedProjectId === project.id
          return (
            <div key={project.id} className="group flex items-center px-1">
              <button
                onClick={() => onSelect(project.id)}
                className={[
                  'flex-1 flex items-center justify-between px-3 py-1.5 rounded-md text-left transition-colors min-w-0',
                  isSelected
                    ? 'bg-white shadow-sm text-gray-900 font-medium'
                    : 'text-gray-600 hover:bg-white/70 hover:text-gray-800',
                ].join(' ')}
              >
                <span className="text-sm truncate">{project.name}</span>
                {pending > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0 ml-1" title={`${pending} 条待处理`} />
                )}
              </button>
              <button
                onClick={e => { e.stopPropagation(); onSettings(project) }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 rounded transition-opacity flex-shrink-0"
                title="项目设置"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          )
        })}

        {archived.length > 0 && (
          <div className="mt-3 px-3">
            <span className="text-xs text-gray-300">已归档</span>
            {archived.map(project => (
              <div key={project.id} className="group flex items-center">
                <button
                  onClick={() => onSelect(project.id)}
                  className="flex-1 flex items-center px-3 py-1.5 rounded-md text-left text-gray-400 hover:text-gray-600 text-sm min-w-0"
                >
                  <span className="truncate">{project.name}</span>
                </button>
                <button
                  onClick={() => onSettings(project)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-gray-500 rounded transition-opacity flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-gray-100">
        <button
          onClick={onNewProject}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-white rounded-md"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新建项目
        </button>
      </div>
    </aside>
  )
}
