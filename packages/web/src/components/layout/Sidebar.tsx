import { useState } from 'react'
import type { Project, ProjectGroup, ProjectsView, Task } from '@conductor/types'
import { api } from '../../lib/api'
import { PromptDialog, ConfirmDialog } from '../ui/Dialog'
import { useLocale, useT } from '../../lib/i18n'

export const ALL_PROJECTS_ID = '__all__'

interface Props {
  projectsView: ProjectsView
  selectedProjectId: string | null
  tasks: Task[]
  collapsed: boolean
  onToggleCollapse: () => void
  onSelect: (projectId: string) => void
  onNewProject: () => void
  onSettings: (project: Project) => void
  onSystemPrompt: () => void
  onReloadProjects: () => void
}

const GearIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`w-3 h-3 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

// ─── Project item ─────────────────────────────────────────────────────────────

function ProjectItem({
  project, isSelected, collapsed, pendingCount, onSelect, onSettings,
}: {
  project: Project
  isSelected: boolean
  collapsed: boolean
  pendingCount: number
  onSelect: (id: string) => void
  onSettings: (p: Project) => void
}) {
  const t = useT()

  if (collapsed) {
    return (
      <div className="relative flex justify-center py-0.5">
        <button
          onClick={() => onSelect(project.id)}
          title={project.name}
          className={[
            'w-8 h-8 rounded-md flex items-center justify-center text-xs font-semibold transition-colors',
            isSelected ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:bg-white/70 hover:text-gray-800',
          ].join(' ')}
        >
          {project.name.slice(0, 1)}
        </button>
        {pendingCount > 0 && (
          <span className="absolute top-0.5 right-1 w-1.5 h-1.5 rounded-full bg-red-400" />
        )}
      </div>
    )
  }

  return (
    <div className="group flex items-center px-1">
      <button
        onClick={() => onSelect(project.id)}
        className={[
          'flex-1 flex items-center justify-between px-3 py-1.5 rounded-md text-left transition-colors min-w-0',
          isSelected ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-600 hover:bg-white/70 hover:text-gray-800',
        ].join(' ')}
      >
        <span className="text-sm truncate">{project.name}</span>
        {pendingCount > 0 && (
          <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0 ml-1" title={t('pendingN', pendingCount)} />
        )}
      </button>
      <button
        onClick={e => { e.stopPropagation(); onSettings(project) }}
        className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md transition-opacity flex-shrink-0"
        title={t('projectSettings')}
      >
        <GearIcon />
      </button>
    </div>
  )
}

// ─── Group section ────────────────────────────────────────────────────────────

function GroupSection({
  group, selectedProjectId, collapsed, pendingByProject,
  onSelect, onSettings, onReload,
}: {
  group: ProjectGroup & { projects: Project[] }
  selectedProjectId: string | null
  collapsed: boolean
  pendingByProject: Map<string, number>
  onSelect: (id: string) => void
  onSettings: (p: Project) => void
  onReload: () => void
}) {
  const t = useT()
  const [open, setOpen] = useState(!group.collapsed)
  const [moreOpen, setMoreOpen] = useState(false)
  const [showGroupSettings, setShowGroupSettings] = useState(false)
  const [editingName, setEditingName] = useState(group.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const pinned = group.projects.filter(p => p.pinned !== false)
  const unpinned = group.projects.filter(p => p.pinned === false)

  async function handleSaveGroup() {
    await api.groups.update(group.id, { name: editingName })
    setShowGroupSettings(false)
    onReload()
  }

  async function handleDeleteGroup() {
    await api.groups.delete(group.id)
    setConfirmDelete(false)
    setShowGroupSettings(false)
    onReload()
  }

  if (collapsed) {
    return (
      <div className="py-1 border-b border-gray-100/60 last:border-0">
        {group.projects.map(p => (
          <ProjectItem
            key={p.id}
            project={p}
            isSelected={selectedProjectId === p.id}
            collapsed
            pendingCount={pendingByProject.get(p.id) ?? 0}
            onSelect={onSelect}
            onSettings={onSettings}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          message={t('confirmDeleteGroup', group.name)}
          confirmLabel={t('confirmDelete')}
          danger
          onConfirm={handleDeleteGroup}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {showGroupSettings && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">{t('groupSettings')}</h3>
            <input
              value={editingName}
              onChange={e => setEditingName(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder={t('groupNamePlaceholder')}
            />
            <div className="flex justify-between items-center pt-1">
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-red-400 hover:text-red-600"
              >
                {t('deleteGroup')}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowGroupSettings(false)}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 rounded-md hover:bg-gray-100"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleSaveGroup}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="py-1 border-b border-gray-100/60 last:border-0">
        {/* Group header */}
        <div className="group flex items-center px-2 py-1">
          <button
            onClick={() => setOpen(v => !v)}
            className="flex-1 flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 min-w-0"
          >
            <ChevronIcon open={open} />
            <span className="truncate">{group.name}</span>
          </button>
          <button
            onClick={() => { setEditingName(group.name); setShowGroupSettings(true) }}
            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded transition-opacity flex-shrink-0"
            title={t('groupSettings')}
          >
            <GearIcon />
          </button>
        </div>

        {open && (
          <div className="space-y-0">
            {pinned.map(p => (
              <ProjectItem
                key={p.id}
                project={p}
                isSelected={selectedProjectId === p.id}
                collapsed={false}
                pendingCount={pendingByProject.get(p.id) ?? 0}
                onSelect={onSelect}
                onSettings={onSettings}
              />
            ))}

            {unpinned.length > 0 && (
              <div className="px-1">
                <button
                  onClick={() => setMoreOpen(v => !v)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-3 py-1"
                >
                  <ChevronIcon open={moreOpen} />
                  {t('more', unpinned.length)}
                </button>
                {moreOpen && unpinned.map(p => (
                  <ProjectItem
                    key={p.id}
                    project={p}
                    isSelected={selectedProjectId === p.id}
                    collapsed={false}
                    pendingCount={pendingByProject.get(p.id) ?? 0}
                    onSelect={onSelect}
                    onSettings={onSettings}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  projectsView, selectedProjectId, tasks, collapsed,
  onToggleCollapse, onSelect, onNewProject, onSettings, onSystemPrompt, onReloadProjects,
}: Props) {
  const t = useT()
  const [locale, setLocale] = useLocale()
  const [newGroupPrompt, setNewGroupPrompt] = useState(false)
  const [showSystemProjects, setShowSystemProjects] = useState(() => {
    return localStorage.getItem('conductor_show_system_projects') === 'true'
  })

  function toggleSystemProjects() {
    const next = !showSystemProjects
    setShowSystemProjects(next)
    localStorage.setItem('conductor_show_system_projects', String(next))
  }

  // Count pending human tasks per project
  const pendingByProject = new Map<string, number>()
  for (const task of tasks) {
    if (task.assignee === 'human' && task.status === 'pending') {
      pendingByProject.set(task.projectId, (pendingByProject.get(task.projectId) ?? 0) + 1)
    }
  }

  const { groups, ungrouped } = projectsView
  // proj_conductor is the background maintenance project — always hidden.
  // Other system projects (e.g. proj_default 日常事务) are shown/hidden by user toggle.
  const visibleUngrouped = ungrouped.filter(p => {
    if (p.id === 'proj_conductor') return false          // maintenance, always hidden
    if (p.createdBy === 'system') return showSystemProjects  // other system projects: user-controlled
    return true                                          // human projects: always visible
  })
  const archivedUngrouped = visibleUngrouped.filter(p => p.archived)
  const activeUngrouped = visibleUngrouped.filter(p => !p.archived)

  async function handleCreateGroup(name: string) {
    setNewGroupPrompt(false)
    await api.groups.create({ name })
    onReloadProjects()
  }

  return (
    <aside
      className={[
        'flex-shrink-0 border-r border-gray-100 flex flex-col h-full bg-gray-50 transition-all duration-200',
        collapsed ? 'w-12' : 'w-56',
      ].join(' ')}
    >
      {newGroupPrompt && (
        <PromptDialog
          title={t('newGroup')}
          placeholder={t('groupNamePlaceholder')}
          confirmLabel={t('create')}
          onConfirm={handleCreateGroup}
          onCancel={() => setNewGroupPrompt(false)}
        />
      )}

      {/* Header */}
      <div className={[
        'flex items-center border-b border-gray-100 flex-shrink-0',
        collapsed ? 'justify-center px-2 py-3' : 'justify-between px-4 py-3',
      ].join(' ')}>
        {!collapsed && <h1 className="text-sm font-semibold text-gray-800 tracking-tight">Conductor</h1>}
        <button
          onClick={onToggleCollapse}
          className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors flex-shrink-0"
          title={collapsed ? t('expandSidebar') : t('collapsesidebar')}
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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {/* All projects entry */}
        {collapsed ? (
          <div className="flex justify-center py-0.5">
            <button
              onClick={() => onSelect(ALL_PROJECTS_ID)}
              title={t('allProjects')}
              className={[
                'w-8 h-8 rounded-md flex items-center justify-center transition-colors',
                selectedProjectId === ALL_PROJECTS_ID ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:bg-white/70 hover:text-gray-700',
              ].join(' ')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="px-1 mb-2">
            <button
              onClick={() => onSelect(ALL_PROJECTS_ID)}
              className={[
                'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors',
                selectedProjectId === ALL_PROJECTS_ID ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500 hover:bg-white/70 hover:text-gray-700',
              ].join(' ')}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span className="text-sm">{t('allProjects')}</span>
            </button>
          </div>
        )}

        {/* Groups */}
        {groups.map(group => (
          <GroupSection
            key={group.id}
            group={group}
            selectedProjectId={selectedProjectId}
            collapsed={collapsed}
            pendingByProject={pendingByProject}
            onSelect={onSelect}
            onSettings={onSettings}
            onReload={onReloadProjects}
          />
        ))}

        {/* Ungrouped active projects */}
        {activeUngrouped.length > 0 && (
          <div className={['py-1', groups.length > 0 ? 'border-b border-gray-100/60' : ''].join(' ')}>
            {!collapsed && groups.length > 0 && (
              <div className="px-3 pt-1 pb-0.5">
                <span className="text-xs text-gray-300 uppercase tracking-wider">{t('ungrouped')}</span>
              </div>
            )}
            {activeUngrouped.map(p => (
              <ProjectItem
                key={p.id}
                project={p}
                isSelected={selectedProjectId === p.id}
                collapsed={collapsed}
                pendingCount={pendingByProject.get(p.id) ?? 0}
                onSelect={onSelect}
                onSettings={onSettings}
              />
            ))}
          </div>
        )}

        {/* Archived */}
        {archivedUngrouped.length > 0 && !collapsed && (
          <div className="mt-3 px-3">
            <span className="text-xs text-gray-300">{t('archived')}</span>
            {archivedUngrouped.map(p => (
              <div key={p.id} className="group flex items-center">
                <button
                  onClick={() => onSelect(p.id)}
                  className="flex-1 flex items-center px-3 py-1.5 rounded-md text-left text-gray-400 hover:text-gray-600 text-sm min-w-0"
                >
                  <span className="truncate">{p.name}</span>
                </button>
                <button
                  onClick={() => onSettings(p)}
                  className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-gray-500 rounded-md transition-opacity flex-shrink-0"
                >
                  <GearIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom actions */}
      <div className={['border-t border-gray-100 space-y-0.5', collapsed ? 'p-1.5' : 'p-3'].join(' ')}>
        {collapsed ? (
          <>
            <button onClick={onNewProject} title={t('newProject')}
              className="w-full h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-white rounded-md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button onClick={onSystemPrompt} title={t('systemPrompt')}
              className="w-full h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white rounded-md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            {/* System projects toggle */}
            <button
              onClick={toggleSystemProjects}
              title={showSystemProjects ? '隐藏系统项目' : '显示系统项目'}
              className={['w-full h-8 flex items-center justify-center rounded-md transition-colors',
                showSystemProjects ? 'text-blue-500 hover:bg-blue-50' : 'text-gray-300 hover:text-gray-500 hover:bg-white'
              ].join(' ')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </button>
            <button
              onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
              title={locale === 'zh' ? 'English' : '中文'}
              className="w-full h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white rounded-md text-xs font-medium"
            >
              {locale === 'zh' ? 'EN' : '中'}
            </button>
          </>
        ) : (
          <>
            <button onClick={onNewProject}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 hover:bg-white rounded-md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {t('newProject')}
            </button>
            <button onClick={() => setNewGroupPrompt(true)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-700 hover:bg-white rounded-md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {t('newGroup')}
            </button>
            <button onClick={onSystemPrompt}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-700 hover:bg-white rounded-md">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {t('systemPrompt')}
            </button>
            {/* System projects toggle */}
            <button
              onClick={toggleSystemProjects}
              className={['w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors',
                showSystemProjects
                  ? 'text-blue-600 hover:bg-blue-50'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-white'
              ].join(' ')}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
              <span>{showSystemProjects ? '隐藏系统项目' : '显示系统项目'}</span>
            </button>
            {/* Language toggle */}
            <button
              onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-700 hover:bg-white rounded-md"
              title={locale === 'zh' ? 'Switch to English' : '切换为中文'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              {locale === 'zh' ? 'English' : '中文'}
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
