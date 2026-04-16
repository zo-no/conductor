import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { useT } from '../../lib/i18n'

interface Props {
  onClose: () => void
}

export function SystemPromptDialog({ onClose }: Props) {
  const t = useT()
  const [content, setContent] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.prompts.getSystem().then(p => {
      setContent(p?.content ?? '')
      setLoaded(true)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      if (content.trim()) {
        await api.prompts.setSystem(content.trim())
      } else {
        // DELETE not in api, use setSystem with empty to clear — backend handles via PATCH
        await api.prompts.setSystem('')
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{t('systemPromptTitle')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('systemPromptSubtitle')}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!loaded ? (
            <p className="text-xs text-gray-400">{t('loadingPrompt')}</p>
          ) : (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={t('systemPromptPlaceholder')}
              rows={10}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none font-mono text-xs"
              autoFocus
            />
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !loaded}
            className="px-4 py-1.5 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
