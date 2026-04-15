import type { Project, Task } from '@conductor/types'

interface Props {
  projects: Project[]
  selectedProjectId: string | null
  tasks: Task[]
  collapsed: boolean
  onToggleCollapse: () => void
  onSelect: (projectId: string) => void
  onNewProject: () => void
  onSettings: (project: Project) => void
}

const GearIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

export function Sidebar({
  projects, selectedProjectId, tasks, collapsed,
  onToggleCollapse, onSelect, onNewProject, onSettings,
}: Props) {
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
    <aside
      className={[
        'flex-shrink-0 border-r border-gray-100 flex flex-col h-full bg-gray-50 transition-all duration-200',
        collapsed ? 'w-12' : 'w-56',
      ].join(' ')}
    >
      {/* Header: logo + collapse toggle */}
      <div className={[
        'flex items-center border-b border-gray-100 flex-shrink-0',
        collapsed ? 'justify-center px-2 py-3' : 'justify-between px-4 py-3',
      ].join(' ')}>
        {!collapsed && (
          <h1 className="text-sm font-semibold text-gray-800 tracking-tight">Conductor</h1>
        )}
        <button
          onClick={onToggleCollapse}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors flex-shrink-0"
          title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
        >
          {collapsed ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Project list */}
      <nav className="flex-1 overflow-y-auto py-2">
        {!collapsed && (
          <div className="px-3 mb-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">我的项目</span>
          </div>
        )}

        {active.map(project => {
          const pending = pendingByProject.get(project.id) ?? 0
          const isSelected = selectedProjectId === project.id

          if (collapsed) {
            return (
              <div key={project.id} className="relative flex justify-center py-0.5">
                <button
                  onClick={() => onSelect(project.id)}
                  title={project.name}
                  className={[
                    'w-8 h-8 rounded-md flex items-center justify-center text-xs font-semibold transition-colors',
                    isSelected
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:bg-white/70 hover:text-gray-800',
                  ].join(' ')}
                >
                  {project.name.slice(0, 1)}
                </button>
                {pending > 0 && (
                  <span className="absolute top-0.5 right-1 w-1.5 h-1.5 rounded-full bg-red-400" />
                )}
              </div>
            )
          }

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
              {/* 44px touch target for gear */}
              <button
                onClick={e => { e.stopPropagation(); onSettings(project) }}
                className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md transition-opacity flex-shrink-0"
                title="项目设置"
              >
                <GearIcon />
              </button>
            </div>
          )
        })}

        {archived.length > 0 && !collapsed && (
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
                  className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded-md transition-opacity flex-shrink-0"
                >
                  <GearIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* New project button */}
      <div className={['border-t border-gray-100', collapsed ? 'p-1.5' : 'p-3'].join(' ')}>
        {collapsed ? (
          <button
            onClick={onNewProject}
            title="新建项目"
            className="w-full h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-white rounded-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onNewProject}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-white rounded-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            新建项目
          </button>
        )}
      </div>
    </aside>
  )
}
