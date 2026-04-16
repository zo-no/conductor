// Auth state management for the web UI
// Token stored in sessionStorage (cleared when browser tab closes)

const TOKEN_KEY = 'conductor_token'

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token.trim())
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

// Probe /api/projects — 401 means auth required, anything else means open
export async function checkAuthRequired(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? '') + '/api'
    const res = await fetch(`${apiBase}/projects`, { signal: controller.signal })
    clearTimeout(timeout)
    return res.status === 401
  } catch {
    return false
  }
}
