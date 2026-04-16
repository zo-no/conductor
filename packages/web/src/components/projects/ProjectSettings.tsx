import { useEffect, useRef, useState } from 'react'
import type { Project, ProjectGroup } from '@conductor/types'
import { api } from '../../lib/api'
import { ConfirmDialog } from '../ui/Dialog'
import { useT } from '../../lib/i18n'

interface Props {
  project: Project
  onDone: (updated?: Project) => void
  onDelete: () => void
}

export function ProjectSettings({ project, onDone, onDelete }: Props) {
  const t = useT()
  const [name, setName] = useState(project.name)
  const [goal, setGoal] = useState(project.goal ?? '')
  const [workDir, setWorkDir] = useState(project.workDir ?? '')
  const [groupId, setGroupId] = useState<string>(project.groupId ?? '')
  const [pinned, setPinned] = useState(project.pinned !== false)
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  // Prompt — always shown, load on mount
  const [promptContent, setPromptContent] = useState('')
  const [promptLoaded, setPromptLoaded] = useState(false)
  const promptLoadedRef = useRef(false)

  useEffect(() => {
    api.groups.list().then(gs => setGroups(gs)).catch(() => {})
  }, [])

  useEffect(() => {
    if (promptLoadedRef.current) return
    promptLoadedRef.current = true
    api.prompts.getProject(project.id)
      .then(p => setPromptContent(p?.content ?? ''))
      .catch(() => {})
      .finally(() => setPromptLoaded(true))
  }, [project.id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError(t('projectNameRequired')); return }
    setSaving(true)
    setError('')
    try {
      // Save general
      const updated = await api.projects.update(project.id, {
        name: name.trim(),
        goal: goal.trim() || undefined,
        workDir: workDir.trim() || undefined,
        groupId: groupId || undefined,
        pinned,
      })
      // Save prompt
      if (promptLoaded) {
        if (promptContent.trim()) {
          await api.prompts.setProject(project.id, promptContent.trim())
        } else {
          await api.prompts.deleteProject(project.id).catch(() => {})
        }
      }
      onDone(updated)
    } catch (e: any) {
      setError(e.message ?? t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleArchiveConfirmed() {
    setConfirmArchive(false)
    if (project.archived) {
      await api.projects.unarchive(project.id)
    } else {
      await api.projects.archive(project.id)
    }
    onDone()
  }

  async function handleDeleteConfirmed() {
    setConfirmDelete(false)
    await api.projects.delete(project.id)
    onDelete()
  }

  return (
    <>
      {confirmDelete && (
        <ConfirmDialog
          message={t('confirmDeleteProject', project.name)}
          confirmLabel={t('confirmDelete')}
          danger
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {confirmArchive && (
        <ConfirmDialog
          message={project.archived ? t('confirmUnarchiveProject', project.name) : t('confirmArchiveProject', project.name)}
          confirmLabel={project.archived ? t('unarchiveProject') : t('archiveProject')}
          onConfirm={handleArchiveConfirmed}
          onCancel={() => setConfirmArchive(false)}
        />
      )}

      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">{project.name}</h2>
            <div className="flex items-center gap-0.5">
              {/* Archive icon */}
              <button
                onClick={() => setConfirmArchive(true)}
                title={project.archived ? t('unarchiveProject') : t('archiveProject')}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md"
              >
                {project.archived ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
                  </svg>
                )}
              </button>
              {/* Delete icon */}
              <button
                onClick={() => setConfirmDelete(true)}
                title={t('deleteProject')}
                className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 rounded-md"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              {/* Close */}
              <button
                onClick={() => onDone()}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave}>
            <div className="px-4 py-3 space-y-3">
              {/* Name */}
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('projectNamePlaceholder')}
                autoFocus
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400"
              />

              {/* Goal */}
              <textarea
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder={t('goalPlaceholder')}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none"
              />

              {/* WorkDir */}
              <input
                value={workDir}
                onChange={e => setWorkDir(e.target.value)}
                placeholder={t('workDirSettingsPlaceholder')}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 font-mono text-xs"
              />

              {/* Group */}
              {groups.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t('groupLabel')}</label>
                  <select
                    value={groupId}
                    onChange={e => setGroupId(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 bg-white"
                  >
                    <option value="">{t('ungrouped')}</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Pinned */}
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-sm text-gray-600">{t('pinnedSidebarLabel')}</span>
                <div
                  onClick={() => setPinned(v => !v)}
                  className={[
                    'relative w-9 h-5 rounded-full transition-colors duration-200',
                    pinned ? 'bg-blue-500' : 'bg-gray-200',
                  ].join(' ')}
                >
                  <span className={[
                    'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                    pinned ? 'translate-x-4' : 'translate-x-0.5',
                  ].join(' ')} />
                </div>
              </label>

              {/* Prompt */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('projectPromptLabel')}</label>
                <textarea
                  value={promptContent}
                  onChange={e => setPromptContent(e.target.value)}
                  placeholder={promptLoaded ? t('projectPromptPlaceholder') : t('loadingPrompt')}
                  disabled={!promptLoaded}
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none font-mono text-xs"
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onDone()}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
