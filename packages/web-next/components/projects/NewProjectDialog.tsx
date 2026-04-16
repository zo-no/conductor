import { useState } from 'react'
import { useT } from '../../lib/i18n'

export interface NewProjectData {
  name: string
  goal?: string
  workDir?: string
  enableBrain: boolean
}

interface Props {
  onConfirm: (data: NewProjectData) => void
  onCancel: () => void
}

export function NewProjectDialog({ onConfirm, onCancel }: Props) {
  const t = useT()
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [workDir, setWorkDir] = useState('')
  const [enableBrain, setEnableBrain] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError(t('projectNameRequired')); return }
    onConfirm({
      name: name.trim(),
      goal: goal.trim() || undefined,
      workDir: workDir.trim() || undefined,
      enableBrain,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{t('newProjectTitle')}</h2>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-md"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-4 py-3 space-y-3">
            {/* Name */}
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('newProjectPlaceholder')}
              autoFocus
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400"
            />

            {/* Goal */}
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder={t('newProjectGoalPlaceholder')}
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none"
            />

            {/* WorkDir */}
            <input
              value={workDir}
              onChange={e => setWorkDir(e.target.value)}
              placeholder={t('newProjectWorkDirPlaceholder')}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900/20 font-mono text-xs"
            />

            {/* Enable Brain */}
            <label className="flex items-center justify-between cursor-pointer select-none">
              <div>
                <span className="text-sm text-gray-700">{t('enableBrainLabel')}</span>
                <p className="text-xs text-gray-400 mt-0.5">{t('enableBrainDesc')}</p>
              </div>
              <div
                onClick={() => setEnableBrain(v => !v)}
                className={[
                  'relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ml-3',
                  enableBrain ? 'bg-blue-500' : 'bg-gray-200',
                ].join(' ')}
              >
                <span className={[
                  'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                  enableBrain ? 'translate-x-4' : 'translate-x-0.5',
                ].join(' ')} />
              </div>
            </label>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800"
            >
              {t('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
