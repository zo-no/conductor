import { useCallback, useEffect, useState } from 'react'
import type { Project, ProjectsView, Task } from '@conductor/types'
import { api } from './lib/api'
import { useSSE } from './hooks/useSSE'
import { useWindowWidth } from './hooks/useWindowWidth'
import { useSwipe } from './hooks/useSwipe'
import { Sidebar, ALL_PROJECTS_ID } from './components/layout/Sidebar'
import { Timeline } from './components/tasks/Timeline'
import { TaskDetail } from './components/tasks/TaskDetail'
import { TaskForm } from './components/tasks/TaskForm'
import { ProjectSettings } from './components/projects/ProjectSettings'
import { SystemPromptDialog } from './components/projects/SystemPromptDialog'
import { PromptDialog } from './components/ui/Dialog'

type AssigneeTab = 'all' | 'human' | 'ai'

export default function App() {
  const [projectsView, setProjectsView] = useState<ProjectsView>({ groups: [], ungrouped: [] })
  // flat list for backward compat (task filtering, etc.)
  const projects: Project[] = [...projectsView.groups.flatMap(g => g.projects), ...projectsView.ungrouped]
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('project')
  })
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [pendingTaskId] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('task')
  })
  const [assigneeTab, setAssigneeTab] = useState<AssigneeTab>('all')
  const [loading, setLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Modals
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [settingsProject, setSettingsProject] = useState<Project | null>(null)
  const [newProjectPrompt, setNewProjectPrompt] = useState(false)
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)

  // Bulk select
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Responsive — reactive to window resize
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 768

  // Load projects view (grouped)
  const loadProjects = useCallback(() => {
    return api.projects.view().then(view => {
      setProjectsView(view)
      return [...view.groups.flatMap(g => g.projects), ...view.ungrouped]
    })
  }, [])

  useEffect(() => {
    loadProjects().then(ps => {
      if (ps.length > 0 && !selectedProjectId) setSelectedProjectId(ps[0].id)
    }).finally(() => setLoading(false))
  }, [loadProjects]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load tasks — all projects or single project
  const loadTasks = useCallback(() => {
    if (!selectedProjectId) return
    const params = selectedProjectId === ALL_PROJECTS_ID ? {} : { projectId: selectedProjectId }
    api.tasks.list(params).then(setTasks)
  }, [selectedProjectId])

  useEffect(() => { loadTasks() }, [loadTasks])

  // SSE: refresh tasks on any event
  const handleSSE = useCallback(() => {
    loadTasks()
  }, [loadTasks])

  // Global view: subscribe to all events (no projectId filter)
  const sseProjectId = selectedProjectId === ALL_PROJECTS_ID ? '__all__' : selectedProjectId
  useSSE(sseProjectId, handleSSE)

  // Keep selectedTask in sync with latest task data; also restore from URL on first load
  useEffect(() => {
    if (selectedTask) {
      const fresh = tasks.find(t => t.id === selectedTask.id)
      if (fresh) setSelectedTask(fresh)
    } else if (pendingTaskId) {
      const found = tasks.find(t => t.id === pendingTaskId)
      if (found) setSelectedTask(found)
    }
  }, [tasks]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync selection to URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (selectedProjectId) params.set('project', selectedProjectId)
    if (selectedTask) params.set('task', selectedTask.id)
    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState(null, '', newUrl)
  }, [selectedProjectId, selectedTask])

  function handleSelectProject(id: string) {
    setSelectedProjectId(id)
    setSelectedTask(null)
  }

  function handleNewProject() {
    setNewProjectPrompt(true)
  }

  async function handleNewProjectConfirm(name: string) {
    setNewProjectPrompt(false)
    const project = await api.projects.create({ name })
    await loadProjects()
    setSelectedProjectId(project.id)
  }

  function handleNewTask() {
    setEditingTask(null)
    setShowTaskForm(true)
  }

  function handleEditTask(task: Task) {
    setEditingTask(task)
    setShowTaskForm(true)
  }

  function handleTaskFormDone() {
    setShowTaskForm(false)
    setEditingTask(null)
    loadTasks()
  }

  function handleTaskDeleted() {
    setSelectedTask(null)
    loadTasks()
  }

  function handleToggleSelect(taskId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(taskId) ? next.delete(taskId) : next.add(taskId)
      return next
    })
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    await Promise.all([...selectedIds].map(id => api.tasks.delete(id)))
    setSelectedIds(new Set())
    setSelectMode(false)
    loadTasks()
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  function handleProjectSettingsDone(updated?: Project) {
    setSettingsProject(null)
    loadProjects().then(ps => {
      if (selectedProjectId && !ps.find(p => p.id === selectedProjectId)) {
        setSelectedProjectId(ps.length > 0 ? ps[0].id : null)
        setSelectedTask(null)
      }
    })
    if (updated) loadTasks()
  }

  function handleProjectDeleted() {
    setSettingsProject(null)
    loadProjects().then(ps => {
      setSelectedProjectId(ps.length > 0 ? ps[0].id : null)
      setSelectedTask(null)
    })
  }

  const projectTasks = tasks

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400 text-sm">
        加载中...
      </div>
    )
  }

  const modals = (
    <>
      {newProjectPrompt && (
        <PromptDialog
          title="新建项目"
          placeholder="项目名称"
          confirmLabel="创建"
          onConfirm={handleNewProjectConfirm}
          onCancel={() => setNewProjectPrompt(false)}
        />
      )}
      {showTaskForm && selectedProjectId && (
        <TaskForm
          projectId={selectedProjectId}
          task={editingTask ?? undefined}
          onDone={handleTaskFormDone}
          onCancel={() => { setShowTaskForm(false); setEditingTask(null) }}
        />
      )}
      {settingsProject && (
        <ProjectSettings
          project={settingsProject}
          onDone={handleProjectSettingsDone}
          onDelete={handleProjectDeleted}
        />
      )}
      {showSystemPrompt && (
        <SystemPromptDialog onClose={() => setShowSystemPrompt(false)} />
      )}
    </>
  )

  if (isMobile) {
    return (
      <>
        <MobileLayout
          projectsView={projectsView}
          tasks={projectTasks}
          allTasks={tasks}
          selectedProjectId={selectedProjectId}
          selectedTask={selectedTask}
          assigneeTab={assigneeTab}
          onSelectProject={handleSelectProject}
          onSelectTask={setSelectedTask}
          onCloseTask={() => setSelectedTask(null)}
          onEditTask={handleEditTask}
          onDeletedTask={handleTaskDeleted}
          onRefresh={loadTasks}
          onNewProject={handleNewProject}
          onNewTask={handleNewTask}
          onSettings={setSettingsProject}
          onTabChange={setAssigneeTab}
          onReloadProjects={loadProjects}
        />
        {modals}
      </>
    )
  }

  return (
    <>
      <div className="h-screen flex bg-white overflow-hidden relative">
        {/* Sidebar — collapsible */}
        <Sidebar
          projectsView={projectsView}
          selectedProjectId={selectedProjectId}
          tasks={tasks}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(v => !v)}
          onSelect={handleSelectProject}
          onNewProject={handleNewProject}
          onSettings={setSettingsProject}
          onSystemPrompt={() => setShowSystemPrompt(true)}
          onReloadProjects={loadProjects}
        />

        {/* Main timeline */}
        <main className="flex-1 overflow-y-auto min-w-0">
          {selectedProjectId ? (
            <>
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between z-10">
                <h2 className="text-sm font-semibold text-gray-800 truncate">
                  {selectedProjectId === ALL_PROJECTS_ID
                    ? '全部任务'
                    : projects.find(p => p.id === selectedProjectId)?.name ?? ''}
                </h2>
                <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                  {selectMode ? (
                    <>
                      {selectedIds.size > 0 && (
                        <button
                          onClick={handleBulkDelete}
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2.5 py-1.5 rounded-md hover:bg-red-50 transition-colors"
                        >
                          删除 {selectedIds.size} 项
                        </button>
                      )}
                      <button
                        onClick={exitSelectMode}
                        className="text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      {selectedProjectId !== ALL_PROJECTS_ID && (
                        <button
                          onClick={() => setSelectMode(true)}
                          className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                          title="批量管理"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </button>
                      )}
                      {selectedProjectId !== ALL_PROJECTS_ID && (
                        <button
                          onClick={handleNewTask}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          新建任务
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 max-w-2xl">
                <Timeline
                  tasks={projectTasks}
                  projects={selectedProjectId === ALL_PROJECTS_ID ? projects : undefined}
                  onSelect={setSelectedTask}
                  onRefresh={loadTasks}
                  selectedTaskId={selectMode ? undefined : selectedTask?.id}
                  selectMode={selectMode}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              选择或创建一个项目
            </div>
          )}
        </main>

        {/* Task detail — floating card from right with blurred backdrop */}
        {selectedTask && selectedProjectId && (
          <>
            <div
              className="absolute inset-0 backdrop-blur-[2px] bg-black/10 z-10"
              onClick={() => setSelectedTask(null)}
            />
            <div className="absolute top-0 right-0 h-full z-20 p-3">
              <div className="h-full w-80 bg-white/95 backdrop-blur-md rounded-xl shadow-2xl overflow-hidden flex flex-col">
                <TaskDetail
                  task={selectedTask}
                  allTasks={tasks}
                  projectId={selectedProjectId}
                  onClose={() => setSelectedTask(null)}
                  onRefresh={loadTasks}
                  onEdit={() => handleEditTask(selectedTask)}
                  onDeleted={handleTaskDeleted}
                />
              </div>
            </div>
          </>
        )}
      </div>
      {modals}
    </>
  )
}

// ─── Mobile Layout ────────────────────────────────────────────────────────────

interface MobileProps {
  projectsView: ProjectsView
  tasks: Task[]
  allTasks: Task[]
  selectedProjectId: string | null
  selectedTask: Task | null
  assigneeTab: AssigneeTab
  onSelectProject: (id: string) => void
  onSelectTask: (task: Task) => void
  onCloseTask: () => void
  onEditTask: (task: Task) => void
  onDeletedTask: () => void
  onRefresh: () => void
  onNewProject: () => void
  onNewTask: () => void
  onSettings: (project: Project) => void
  onTabChange: (tab: AssigneeTab) => void
  onReloadProjects: () => void
}

function MobileLayout({
  projectsView, tasks, allTasks, selectedProjectId, selectedTask,
  assigneeTab, onSelectProject, onSelectTask, onCloseTask,
  onEditTask, onDeletedTask, onRefresh, onNewProject, onNewTask, onSettings, onTabChange,
  onReloadProjects,
}: MobileProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({})
  const selectedTaskId = selectedTask?.id
  const allProjects = [...projectsView.groups.flatMap(g => g.projects), ...projectsView.ungrouped]
  const currentProject = allProjects.find(p => p.id === selectedProjectId)
  // visible = non-system, non-archived ungrouped
  const activeUngrouped = projectsView.ungrouped.filter(p => !p.archived && p.createdBy !== 'system')
  const archivedProjects = [...projectsView.groups.flatMap(g => g.projects), ...projectsView.ungrouped].filter(p => p.archived && p.createdBy !== 'system')

  // Swipe right from left edge to open drawer, swipe left to close
  const swipe = useSwipe(
    () => setDrawerOpen(false),   // swipe left → close drawer
    () => setDrawerOpen(true),    // swipe right → open drawer
  )

  // Task detail — right-side floating card with blurred backdrop
  if (selectedTask && selectedProjectId) {
    return (
      <div className="h-[100dvh] flex flex-col bg-white relative overflow-hidden">
        {/* Keep the main content visible but blurred behind */}
        <div className="fixed inset-0 backdrop-blur-sm bg-black/20 z-30" onClick={onCloseTask} />
        {/* Floating card from right */}
        <div className="fixed top-0 right-0 h-full z-40 flex flex-col" style={{ width: '92%', maxWidth: '400px' }}>
          <div className="flex flex-col h-full bg-white/95 backdrop-blur-md shadow-2xl rounded-l-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100/80 flex-shrink-0">
              <button onClick={onCloseTask} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 -ml-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium text-gray-800">返回</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <TaskDetail
                task={selectedTask}
                allTasks={allTasks}
                projectId={selectedProjectId}
                onClose={onCloseTask}
                onRefresh={onRefresh}
                onEdit={() => onEditTask(selectedTask)}
                onDeleted={onDeletedTask}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-white relative overflow-hidden">
      {/* Header — left icon | center title | right icon, symmetric */}
      <div className="flex items-center px-4 py-3 border-b border-gray-100 flex-shrink-0">
        {/* Left: hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-800 flex-shrink-0 -ml-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Center: project name */}
        <h1 className="flex-1 text-center text-sm font-semibold text-gray-900 truncate px-2">
          {currentProject?.name ?? 'Conductor'}
        </h1>

        {/* Right: settings (same size as hamburger) */}
        {currentProject ? (
          <button
            onClick={() => onSettings(currentProject)}
            className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0 -mr-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        ) : (
          <div className="w-9 flex-shrink-0" />
        )}
      </div>

      {/* Assignee tabs */}
      <div className="flex items-center border-b border-gray-100 flex-shrink-0">
        {(['all', 'human', 'ai'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 py-2.5 text-sm font-medium ${
              assigneeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-400'
            }`}
          >
            {{ all: '全部', human: '人类', ai: 'AI' }[tab]}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20" {...swipe}>
        <Timeline
          tasks={tasks}
          assigneeFilter={assigneeTab === 'all' ? undefined : assigneeTab}
          onSelect={onSelectTask}
          onRefresh={onRefresh}
          selectedTaskId={selectedTaskId}
        />
      </div>

      {/* FAB */}
      <button
        onClick={onNewTask}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-600 active:scale-95 transition-all z-20"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Left drawer backdrop — blur */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 backdrop-blur-sm bg-black/20"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Left drawer — floating card */}
      <div className={[
        'fixed top-0 left-0 h-full z-40 flex flex-col transition-transform duration-200',
        drawerOpen ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')} style={{ width: '72%', maxWidth: '280px' }}>
        {/* Drawer inner card */}
        <div className="flex flex-col h-full bg-white/95 backdrop-blur-md shadow-2xl rounded-r-2xl overflow-hidden">
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100/80">
          <h2 className="text-sm font-semibold text-gray-800">Conductor</h2>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Project list */}
        <nav className="flex-1 overflow-y-auto py-2">
          {/* All projects */}
          <button
            onClick={() => { onSelectProject('__all__'); setDrawerOpen(false) }}
            className={[
              'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors',
              selectedProjectId === '__all__' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-50',
            ].join(' ')}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            全部
          </button>

          {/* Groups */}
          {projectsView.groups.map(group => {
            const isOpen = groupExpanded[group.id] !== false && !group.collapsed
            const pinnedProjects = group.projects.filter(p => p.pinned !== false && !p.archived)
            const unpinnedProjects = group.projects.filter(p => p.pinned === false && !p.archived)
            return (
              <div key={group.id} className="border-t border-gray-50 mt-1 pt-1">
                <button
                  onClick={() => setGroupExpanded(prev => ({ ...prev, [group.id]: !isOpen }))}
                  className="w-full flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600"
                >
                  <svg className={`w-2.5 h-2.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {group.name}
                </button>
                {isOpen && (
                  <>
                    {pinnedProjects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { onSelectProject(p.id); setDrawerOpen(false) }}
                        className={[
                          'w-full flex items-center px-6 py-2 text-sm text-left transition-colors',
                          selectedProjectId === p.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50',
                        ].join(' ')}
                      >
                        <span className="flex-1 truncate">{p.name}</span>
                        {selectedProjectId === p.id && (
                          <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                    {unpinnedProjects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { onSelectProject(p.id); setDrawerOpen(false) }}
                        className={[
                          'w-full flex items-center px-6 py-2 text-sm text-left transition-colors text-gray-400',
                          selectedProjectId === p.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50',
                        ].join(' ')}
                      >
                        <span className="flex-1 truncate">{p.name}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )
          })}

          {/* Ungrouped active */}
          {activeUngrouped.length > 0 && (
            <div className={projectsView.groups.length > 0 ? 'border-t border-gray-50 mt-1 pt-1' : ''}>
              {projectsView.groups.length > 0 && (
                <div className="px-4 py-1">
                  <span className="text-xs text-gray-300 uppercase tracking-wider">未分组</span>
                </div>
              )}
              {activeUngrouped.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onSelectProject(p.id); setDrawerOpen(false) }}
                  className={[
                    'w-full flex items-center px-4 py-2.5 text-sm text-left transition-colors',
                    selectedProjectId === p.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <span className="flex-1 truncate">{p.name}</span>
                  {selectedProjectId === p.id && (
                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Archived */}
          {archivedProjects.length > 0 && (
            <div className="mt-3 px-4 border-t border-gray-50 pt-2">
              <span className="text-xs text-gray-300">已归档</span>
              {archivedProjects.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onSelectProject(p.id); setDrawerOpen(false) }}
                  className="w-full flex items-center px-0 py-2 text-sm text-left text-gray-400 hover:text-gray-600"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* Bottom actions */}
        <div className="p-4 border-t border-gray-100 space-y-1">
          <button
            onClick={() => { onNewProject(); setDrawerOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            新建项目
          </button>
          <button
            onClick={async () => {
              const name = window.prompt('分组名称')
              if (!name?.trim()) return
              await api.groups.create({ name: name.trim() })
              onReloadProjects()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            新建分组
          </button>
        </div>
        </div>{/* end inner card */}
      </div>
    </div>
  )
}
