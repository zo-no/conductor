import { useEffect, useRef, useState } from 'react'
import type { Project } from '@conductor/types'
import { api } from '../../lib/api'
import { ConfirmDialog } from '../ui/Dialog'

interface Props {
  project: Project
  onDone: (updated?: Project) => void
  onDelete: () => void
}

export function ProjectSettings({ project, onDone, onDelete }: Props) {
  const [name, setName] = useState(project.name)
  const [goal, setGoal] = useState(project.goal ?? '')
  const [workDir, setWorkDir] = useState(project.workDir ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  // Prompt — always shown, load on mount
  const [promptContent, setPromptContent] = useState('')
  const [promptLoaded, setPromptLoaded] = useState(false)
  const promptLoadedRef = useRef(false)

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
    if (!name.trim()) { setError('项目名称不能为空'); return }
    setSaving(true)
    setError('')
    try {
      // Save general
      const updated = await api.projects.update(project.id, {
        name: name.trim(),
        goal: goal.trim() || undefined,
        workDir: workDir.trim() || undefined,
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
      setError(e.message ?? '保存失败')
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
          message={`确定删除项目「${project.name}」？此操作不可撤销，项目下所有任务也会被删除。`}
          confirmLabel="删除"
          danger
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {confirmArchive && (
        <ConfirmDialog
          message={project.archived ? `取消归档「${project.name}」？` : `归档项目「${project.name}」？`}
          confirmLabel={project.archived ? '取消归档' : '归档'}
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
                title={project.archived ? '取消归档' : '归档'}
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
                title="删除项目"
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
                placeholder="项目名称"
                autoFocus
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400"
              />

              {/* Goal */}
              <textarea
                value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder="目标描述（注入 AI 上下文）"
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none"
              />

              {/* WorkDir */}
              <input
                value={workDir}
                onChange={e => setWorkDir(e.target.value)}
                placeholder="工作目录  ~/projects/xxx"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 font-mono text-xs"
              />

              {/* Prompt */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">系统 Prompt</label>
                <textarea
                  value={promptContent}
                  onChange={e => setPromptContent(e.target.value)}
                  placeholder={promptLoaded ? '输入项目级 Prompt，留空则不设置' : '加载中...'}
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
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
