import { useState } from 'react'
import type { Project } from '@conductor/types'
import { api } from '../../lib/api'

interface Props {
  project: Project
  onDone: (updated?: Project) => void
  onDelete: () => void
}

type Tab = 'general' | 'prompt'

export function ProjectSettings({ project, onDone, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>('general')

  // General fields
  const [name, setName] = useState(project.name)
  const [goal, setGoal] = useState(project.goal ?? '')
  const [workDir, setWorkDir] = useState(project.workDir ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Prompt
  const [promptContent, setPromptContent] = useState('')
  const [promptLoaded, setPromptLoaded] = useState(false)
  const [promptSaving, setPromptSaving] = useState(false)

  async function loadPrompt() {
    if (promptLoaded) return
    try {
      const p = await api.prompts.getProject(project.id)
      setPromptContent(p?.content ?? '')
    } catch {
      setPromptContent('')
    }
    setPromptLoaded(true)
  }

  async function handleTabChange(t: Tab) {
    setTab(t)
    if (t === 'prompt') loadPrompt()
  }

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('项目名称不能为空'); return }
    setSaving(true)
    setError('')
    try {
      const updated = await api.projects.update(project.id, {
        name: name.trim(),
        goal: goal.trim() || undefined,
        workDir: workDir.trim() || undefined,
      })
      onDone(updated)
    } catch (e: any) {
      setError(e.message ?? '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePrompt() {
    setPromptSaving(true)
    try {
      if (promptContent.trim()) {
        await api.prompts.setProject(project.id, promptContent.trim())
      } else {
        await api.prompts.deleteProject(project.id)
      }
      onDone()
    } catch {}
    setPromptSaving(false)
  }

  async function handleArchive() {
    if (project.archived) {
      await api.projects.unarchive(project.id)
    } else {
      await api.projects.archive(project.id)
    }
    onDone()
  }

  async function handleDelete() {
    if (!confirm(`确定删除项目「${project.name}」？此操作不可撤销，项目下所有任务也会被删除。`)) return
    await api.projects.delete(project.id)
    onDelete()
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">项目设置</h2>
          <button onClick={() => onDone()} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['general', 'prompt'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`flex-1 py-2 text-xs font-medium ${
                tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {{ general: '基本信息', prompt: '系统 Prompt' }[t]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'general' && (
            <form onSubmit={handleSaveGeneral}>
              <div className="px-5 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">项目名称 *</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">目标描述</label>
                  <textarea
                    value={goal}
                    onChange={e => setGoal(e.target.value)}
                    placeholder="项目目标，会注入 AI 上下文"
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">工作目录</label>
                  <input
                    value={workDir}
                    onChange={e => setWorkDir(e.target.value)}
                    placeholder="~/projects/xxx"
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono text-xs"
                  />
                </div>

                {error && <p className="text-xs text-red-500 bg-red-50 rounded px-3 py-2">{error}</p>}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onDone()}
                    className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>

                {/* Danger zone */}
                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">危险操作</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleArchive}
                      className="flex-1 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50"
                    >
                      {project.archived ? '取消归档' : '归档项目'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="flex-1 py-1.5 text-xs border border-red-200 text-red-500 rounded-md hover:bg-red-50"
                    >
                      删除项目
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {tab === 'prompt' && (
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-gray-400">
                项目级 Prompt 会追加在系统 Prompt 之后，在所有 AI 任务中生效。
              </p>
              {!promptLoaded ? (
                <p className="text-xs text-gray-400">加载中...</p>
              ) : (
                <>
                  <textarea
                    value={promptContent}
                    onChange={e => setPromptContent(e.target.value)}
                    placeholder="输入项目级 Prompt，留空则删除"
                    rows={8}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none font-mono text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onDone()}
                      className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSavePrompt}
                      disabled={promptSaving}
                      className="px-4 py-1.5 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                    >
                      {promptSaving ? '保存中...' : '保存'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
