/**
 * Simple token-based auth for the HTTP API.
 *
 * Token is stored in ~/.conductor/auth.json.
 * If no token exists, auth is DISABLED (open access) — suitable for local dev.
 * Once a token is set, every /api/* request must include it via:
 *   - Header:  Authorization: Bearer <token>
 *   - Cookie:  conductor_token=<token>
 *   - Query:   ?token=<token>
 *
 * Generate a token:  conductor auth token
 * Remove auth:       conductor auth disable
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { randomBytes, timingSafeEqual } from 'crypto'
import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'

const CONFIG_DIR = join(homedir(), '.conductor')
const AUTH_FILE = join(CONFIG_DIR, 'auth.json')

interface AuthConfig {
  token: string
}

// ─── Config I/O ───────────────────────────────────────────────────────────────

function readAuthConfig(): AuthConfig | null {
  try {
    if (!existsSync(AUTH_FILE)) return null
    const raw = readFileSync(AUTH_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AuthConfig>
    if (!parsed.token) return null
    return { token: parsed.token }
  } catch {
    return null
  }
}

function writeAuthConfig(config: AuthConfig): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(AUTH_FILE, JSON.stringify(config, null, 2), { mode: 0o600 })
}

function deleteAuthConfig(): void {
  try { unlinkSync(AUTH_FILE) } catch {}
}

// ─── Token management ─────────────────────────────────────────────────────────

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export function enableAuth(): string {
  const token = generateToken()
  writeAuthConfig({ token })
  return token
}

export function disableAuth(): void {
  deleteAuthConfig()
}

export function getToken(): string | null {
  return readAuthConfig()?.token ?? null
}

export function isAuthEnabled(): boolean {
  return readAuthConfig() !== null
}

// ─── Token extraction from request ───────────────────────────────────────────

function extractToken(c: Context): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }

  // 2. Cookie: conductor_token=<token>
  const cookie = getCookie(c, 'conductor_token')
  if (cookie) return cookie

  // 3. Query param: ?token=<token>
  const query = c.req.query('token')
  if (query) return query

  return null
}

// ─── Timing-safe comparison ───────────────────────────────────────────────────

function verifyToken(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length) {
      // Still run comparison to avoid timing leak
      timingSafeEqual(Buffer.alloc(b.length), b)
      return false
    }
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ─── Hono middleware ──────────────────────────────────────────────────────────

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const config = readAuthConfig()

  // Auth disabled — allow all requests
  if (!config) {
    return next()
  }

  // SSE endpoint — check token in query param (EventSource can't set headers)
  // Already handled by extractToken() checking query params

  const provided = extractToken(c)
  if (!provided || !verifyToken(provided, config.token)) {
    return c.json({ error: 'Unauthorized', hint: 'Pass token via Authorization: Bearer <token>' }, 401)
  }

  return next()
}
