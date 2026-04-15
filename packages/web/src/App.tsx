import { useCallback, useEffect, useState } from 'react'
import type { Project, Task } from '@conductor/types'
import { api } from './lib/api'
import { useSSE } from './hooks/useSSE'
import { Sidebar } from './components/layout/Sidebar'
import { Timeline } from './components/tasks/Timeline'
import { TaskDetail } from './components/tasks/TaskDetail'
import { TaskForm } from './components/tasks/TaskForm'
import { ProjectSettings } from './components/projects/ProjectSettings'

type AssigneeTab = 'human' | 'ai'

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [assigneeTab, setAssigneeTab] = useState<AssigneeTab>('human')
  const [loading, setLoading] = useState(true)

  // Modals
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [settingsProject, setSettingsProject] = useState<Project | null>(null)

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

  async function handleNewProject() {
    const name = prompt('项目名称')
    if (!name?.trim()) return
    const project = await api.projects.create({ name: name.trim() })
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

  function handleProjectSettingsDone(updated?: Project) {
    setSettingsProject(null)
    loadProjects().then(ps => {
      // If selected project was deleted, select first available
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

  // Mobile: detect screen size
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400 text-sm">
        加载中...
      </div>
    )
  }

  const modals = (
    <>
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
        {/* Sidebar */}
        <Sidebar
          projects={projects}
          selectedProjectId={selectedProjectId}
          tasks={tasks}
          onSelect={handleSelectProject}
          onNewProject={handleNewProject}
          onSettings={setSettingsProject}
        />

        {/* Main timeline */}
        <main className="flex-1 overflow-y-auto">
          {selectedProjectId ? (
            <>
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between z-10">
                <h2 className="text-sm font-semibold text-gray-800">
                  {projects.find(p => p.id === selectedProjectId)?.name ?? ''}
                </h2>
                <button
                  onClick={handleNewTask}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  新建任务
                </button>
              </div>
              <div className="px-6 py-4 max-w-2xl">
                <Timeline
                  tasks={projectTasks}
                  onSelect={setSelectedTask}
                  onRefresh={loadTasks}
                  selectedTaskId={selectedTask?.id}
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

  // Full screen task detail
  if (selectedTask && selectedProjectId) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <button onClick={onCloseTask} className="text-gray-400 hover:text-gray-600">
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
    <div className="h-screen flex flex-col bg-white">
      {/* Project tabs */}
      <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50 px-2 pt-2 gap-1 flex-shrink-0">
        {projects.map(p => (
          <div key={p.id} className="flex-shrink-0 flex items-center gap-0.5">
            <button
              onClick={() => onSelectProject(p.id)}
              className={`px-3 py-1.5 text-sm rounded-t-md ${
                selectedProjectId === p.id
                  ? 'bg-white text-gray-900 font-medium shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              {p.name}
            </button>
            {selectedProjectId === p.id && (
              <button
                onClick={() => onSettings(p)}
                className="p-1 text-gray-400 hover:text-gray-600"
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
          className="flex-shrink-0 px-3 py-1.5 text-sm text-gray-400"
        >
          +
        </button>
      </div>

      {/* Assignee tabs + new task button */}
      <div className="flex items-center border-b border-gray-100 flex-shrink-0">
        {(['human', 'ai'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 py-2 text-sm font-medium ${
              assigneeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-400'
            }`}
          >
            {tab === 'human' ? '人类' : 'AI'}
          </button>
        ))}
        <button
          onClick={onNewTask}
          className="px-4 py-2 text-gray-400 hover:text-gray-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <Timeline
          tasks={tasks}
          assigneeFilter={assigneeTab}
          onSelect={onSelectTask}
          onRefresh={onRefresh}
          selectedTaskId={selectedTaskId}
        />
      </div>
    </div>
  )
}
