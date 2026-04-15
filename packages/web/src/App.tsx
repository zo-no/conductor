import { useCallback, useEffect, useState } from 'react'
import type { Project, Task } from '@conductor/types'
import { api } from './lib/api'
import { useSSE } from './hooks/useSSE'
import { Sidebar } from './components/layout/Sidebar'
import { Timeline } from './components/tasks/Timeline'
import { TaskDetail } from './components/tasks/TaskDetail'

type AssigneeTab = 'human' | 'ai'

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [assigneeTab, setAssigneeTab] = useState<AssigneeTab>('human')
  const [loading, setLoading] = useState(true)

  // Load projects
  useEffect(() => {
    api.projects.list().then(ps => {
      setProjects(ps)
      if (ps.length > 0) setSelectedProjectId(ps[0].id)
    }).finally(() => setLoading(false))
  }, [])

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
    setProjects(ps => [...ps, project])
    setSelectedProjectId(project.id)
  }

  async function handleNewTask() {
    if (!selectedProjectId) return
    const title = prompt('任务标题')
    if (!title?.trim()) return
    await api.tasks.create({
      projectId: selectedProjectId,
      title: title.trim(),
      assignee: 'human',
      kind: 'once',
    })
    loadTasks()
  }

  const projectTasks = tasks // already filtered by projectId in loadTasks

  // Mobile: detect screen size
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400 text-sm">
        加载中...
      </div>
    )
  }

  if (isMobile) {
    return <MobileLayout
      projects={projects}
      tasks={projectTasks}
      allTasks={tasks}
      selectedProjectId={selectedProjectId}
      selectedTask={selectedTask}
      assigneeTab={assigneeTab}
      onSelectProject={handleSelectProject}
      onSelectTask={setSelectedTask}
      onCloseTask={() => setSelectedTask(null)}
      onRefresh={loadTasks}
      onNewProject={handleNewProject}
      onTabChange={setAssigneeTab}
    />
  }

  return (
    <div className="h-screen flex bg-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        tasks={tasks}
        onSelect={handleSelectProject}
        onNewProject={handleNewProject}
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
        />
      )}
    </div>
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
  onRefresh: () => void
  onNewProject: () => void
  onTabChange: (tab: AssigneeTab) => void
}

function MobileLayout({
  projects, tasks, allTasks, selectedProjectId, selectedTask,
  assigneeTab, onSelectProject, onSelectTask, onCloseTask,
  onRefresh, onNewProject, onTabChange,
}: MobileProps) {
  const selectedTaskId = selectedTask?.id

  // Full screen task detail
  if (selectedTask) {
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
            projectId={selectedProjectId ?? ''}
            onClose={onCloseTask}
            onRefresh={onRefresh}
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
          <button
            key={p.id}
            onClick={() => onSelectProject(p.id)}
            className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-t-md ${
              selectedProjectId === p.id
                ? 'bg-white text-gray-900 font-medium shadow-sm'
                : 'text-gray-500'
            }`}
          >
            {p.name}
          </button>
        ))}
        <button
          onClick={onNewProject}
          className="flex-shrink-0 px-3 py-1.5 text-sm text-gray-400"
        >
          +
        </button>
      </div>

      {/* Assignee tabs */}
      <div className="flex border-b border-gray-100 flex-shrink-0">
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
