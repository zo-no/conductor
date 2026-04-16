import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'

// ─── Confirm Dialog ────────────────────────────────────────────────────────────

interface ConfirmProps {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  message, confirmLabel, cancelLabel,
  danger = false, onConfirm, onCancel,
}: ConfirmProps) {
  const t = useT()
  const resolvedConfirmLabel = confirmLabel ?? t('confirm')
  const resolvedCancelLabel = cancelLabel ?? t('cancel')

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
          >
            {resolvedCancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-1.5 text-sm font-medium rounded-md ${
              danger
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Prompt Dialog ─────────────────────────────────────────────────────────────

interface PromptProps {
  title: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function PromptDialog({
  title, placeholder = '', defaultValue = '',
  confirmLabel, onConfirm, onCancel,
}: PromptProps) {
  const t = useT()
  const resolvedConfirmLabel = confirmLabel ?? t('confirm')
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value.trim()) onConfirm(value.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <p className="text-sm font-medium text-gray-800 mb-3">{title}</p>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 rounded-md hover:bg-gray-100"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="px-4 py-1.5 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-40"
            >
              {resolvedConfirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
