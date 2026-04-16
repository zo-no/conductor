import { useRef, useState } from 'react'
import { setStoredToken } from '../../lib/auth'
import { useT } from '../../lib/i18n'

interface Props {
  onSuccess: () => void
}

export function LoginPage({ onSuccess }: Props) {
  const t = useT()
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = token.trim()
    if (!trimmed) { setError(t('tokenRequired')); return }

    setLoading(true)
    setError('')

    // Verify token by hitting /health with it
    try {
      const apiBase = (import.meta.env.VITE_API_URL ?? '') + '/api'
      const res = await fetch(`${apiBase}/projects`, {
        headers: { 'Authorization': `Bearer ${trimmed}` },
      })
      if (res.status === 401) {
        setError(t('tokenInvalid'))
        setLoading(false)
        inputRef.current?.select()
        return
      }
      setStoredToken(trimmed)
      onSuccess()
    } catch {
      setError(t('tokenInvalid'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Conductor</h1>
          <p className="text-sm text-gray-400 mt-1">{t('loginSubtitle')}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              {t('accessToken')}
            </label>
            <input
              ref={inputRef}
              type="password"
              value={token}
              onChange={e => { setToken(e.target.value); setError('') }}
              placeholder={t('tokenPlaceholder')}
              autoFocus
              autoComplete="current-password"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 font-mono"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full py-2.5 text-sm font-medium bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            {loading ? t('verifying') : t('login')}
          </button>
        </form>

        {/* Hint */}
        <p className="text-center text-xs text-gray-400 mt-4">
          {t('tokenHint')}
        </p>
      </div>
    </div>
  )
}
