// Auth state management for the web UI
// Token is stored in sessionStorage (cleared when browser tab closes)
// Set CONDUCTOR_TOKEN env var or use conductor auth token to generate one

const TOKEN_KEY = 'conductor_token'

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token.trim())
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

// Check if auth is required by probing /api/projects
// Falls back gracefully: if unreachable or no auth, returns false
export async function checkAuthRequired(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const apiBase = (import.meta.env.VITE_API_URL ?? '') + '/api'
    const res = await fetch(`${apiBase}/projects`, { signal: controller.signal })
    clearTimeout(timeout)
    // 401 means auth is enabled and we have no token
    if (res.status === 401) return true
    // Any other response (200, 5xx, etc.) means no auth or already authed
    return false
  } catch {
    // Timeout or network error — assume no auth, let user in
    return false
  }
}
