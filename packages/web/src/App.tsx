import { useCallback, useEffect, useState } from 'react'
import type { Project, Task } from '@conductor/types'
import { api } from './lib/api'
import { useSSE } from './hooks/useSSE'
import { useWindowWidth } from './hooks/useWindowWidth'
import { useSwipe } from './hooks/useSwipe'
import { Sidebar } from './components/layout/Sidebar'
import { Timeline } from './components/tasks/Timeline'
import { TaskDetail } from './components/tasks/TaskDetail'
import { TaskForm } from './components/tasks/TaskForm'
import { ProjectSettings } from './components/projects/ProjectSettings'
import { SystemPromptDialog } from './components/projects/SystemPromptDialog'
import { PromptDialog } from './components/ui/Dialog'

type AssigneeTab = 'all' | 'human' | 'ai'

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
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

  // Load projects
  const loadProjects = useCallback(() => {
    return api.projects.list().then(ps => {
      setProjects(ps)
      return ps
    })
  }, [])

  useEffect(() => {
    loadProjects().then(ps => {
      if (ps.length > 0) setSelectedProjectId(ps[0].id)
    }).finally(() => setLoading(false))
  }, [loadProjects])

  // Load tasks for selected project
  const loadTasks = useCallback(() => {
    if (!selectedProjectId) return
    api.tasks.list({ projectId: selectedProjectId }).then(setTasks)
  }, [selectedProjectId])

  useEffect(() => { loadTasks() }, [loadTasks])

  // SSE: refresh tasks on any event
  const handleSSE = useCallback(() => {
    loadTasks()
  }, [loadTasks])

  useSSE(selectedProjectId, handleSSE)

  // Keep selectedTask in sync with latest task data
  useEffect(() => {
    if (selectedTask) {
      const fresh = tasks.find(t => t.id === selectedTask.id)
      if (fresh) setSelectedTask(fresh)
    }
  }, [tasks]) // eslint-disable-line react-hooks/exhaustive-deps

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
          projects={projects}
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
        />
        {modals}
      </>
    )
  }

  return (
    <>
      <div className="h-screen flex bg-white overflow-hidden">
        {/* Sidebar — collapsible */}
        <Sidebar
          projects={projects}
          selectedProjectId={selectedProjectId}
          tasks={tasks}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(v => !v)}
          onSelect={handleSelectProject}
          onNewProject={handleNewProject}
          onSettings={setSettingsProject}
          onSystemPrompt={() => setShowSystemPrompt(true)}
        />

        {/* Main timeline */}
        <main className="flex-1 overflow-y-auto min-w-0">
          {selectedProjectId ? (
            <>
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between z-10">
                <h2 className="text-sm font-semibold text-gray-800 truncate">
                  {projects.find(p => p.id === selectedProjectId)?.name ?? ''}
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
                      <button
                        onClick={() => setSelectMode(true)}
                        className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                        title="批量管理"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </button>
                      <button
                        onClick={handleNewTask}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        新建任务
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 max-w-2xl">
                <Timeline
                  tasks={projectTasks}
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

        {/* Task detail drawer */}
        {selectedTask && selectedProjectId && (
          <TaskDetail
            task={selectedTask}
            allTasks={tasks}
            projectId={selectedProjectId}
            onClose={() => setSelectedTask(null)}
            onRefresh={loadTasks}
            onEdit={() => handleEditTask(selectedTask)}
            onDeleted={handleTaskDeleted}
          />
        )}
      </div>
      {modals}
    </>
  )
}

// ─── Mobile Layout ────────────────────────────────────────────────────────────

interface MobileProps {
  projects: Project[]
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
}

function MobileLayout({
  projects, tasks, allTasks, selectedProjectId, selectedTask,
  assigneeTab, onSelectProject, onSelectTask, onCloseTask,
  onEditTask, onDeletedTask, onRefresh, onNewProject, onNewTask, onSettings, onTabChange,
}: MobileProps) {
  const selectedTaskId = selectedTask?.id

  // Swipe left/right to switch projects
  const activeProjects = projects.filter(p => !p.archived)
  const currentIdx = activeProjects.findIndex(p => p.id === selectedProjectId)

  const swipe = useSwipe(
    () => {
      // swipe left → next project
      if (currentIdx < activeProjects.length - 1) onSelectProject(activeProjects[currentIdx + 1].id)
    },
    () => {
      // swipe right → prev project
      if (currentIdx > 0) onSelectProject(activeProjects[currentIdx - 1].id)
    }
  )

  // Full screen task detail
  if (selectedTask && selectedProjectId) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-shrink-0">
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
    )
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      {/* Project tabs */}
      <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50 px-2 pt-2 gap-1 flex-shrink-0 scrollbar-none">
        {projects.map(p => (
          <div key={p.id} className="flex-shrink-0 flex items-center gap-0.5">
            <button
              onClick={() => onSelectProject(p.id)}
              className={`px-3 py-1.5 text-sm rounded-t-md whitespace-nowrap ${
                selectedProjectId === p.id
                  ? 'bg-white text-gray-900 font-medium shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              {p.name}
            </button>
            {selectedProjectId === p.id && (
              <button
                onClick={() => { const proj = projects.find(pr => pr.id === p.id); if (proj) onSettings(proj) }}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </div>
        ))}
        <button
          onClick={onNewProject}
          className="flex-shrink-0 w-9 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
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

      {/* Timeline + FAB — swipe to switch project */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-20" {...swipe}>
        <Timeline
          tasks={tasks}
          assigneeFilter={assigneeTab === 'all' ? undefined : assigneeTab}
          onSelect={onSelectTask}
          onRefresh={onRefresh}
          selectedTaskId={selectedTaskId}
        />
      </div>

      {/* Floating action button */}
      <button
        onClick={onNewTask}
        className="absolute bottom-6 right-6 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-600 active:scale-95 transition-all"
        style={{ position: 'fixed' }}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}
