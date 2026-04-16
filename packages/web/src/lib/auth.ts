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

// Fetch /auth/status to check if auth is required
export async function checkAuthRequired(): Promise<boolean> {
  try {
    const res = await fetch('/auth/status')
    if (!res.ok) return false
    const data = await res.json() as { enabled: boolean }
    return data.enabled === true
  } catch {
    return false
  }
}
