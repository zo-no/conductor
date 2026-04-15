import { $ } from 'bun'
import { unlinkSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// Use a separate test DB so we don't pollute ~/.conductor/db.sqlite
export const TEST_DB = join(homedir(), '.conductor', 'test-db.sqlite')
process.env.CONDUCTOR_TEST_DB = TEST_DB

export const API = 'http://localhost:7763'
export const CLI = 'packages/core/cli.ts'

let passed = 0
let failed = 0
const failures: string[] = []

export function ok(label: string) {
  console.log(`  ✓ ${label}`)
  passed++
}

export function fail(label: string, detail?: string) {
  const msg = `  ✗ ${label}${detail ? ': ' + detail : ''}`
  console.error(msg)
  failures.push(msg)
  failed++
}

export function assert(label: string, condition: boolean, detail?: string) {
  condition ? ok(label) : fail(label, detail)
}

export function section(name: string) {
  console.log(`\n── ${name} ──`)
}

export async function cli(...args: string[]): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    const result = await $`bun ${CLI} ${args}`.env({ ...process.env, CONDUCTOR_TEST_DB: TEST_DB }).quiet()
    return { stdout: result.stdout.toString(), stderr: result.stderr.toString(), ok: true }
  } catch (e: any) {
    return { stdout: e.stdout?.toString() ?? '', stderr: e.stderr?.toString() ?? '', ok: false }
  }
}

export function parse(stdout: string): any {
  try { return JSON.parse(stdout.trim()) } catch { return null }
}

export async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ data: any; status: number; ok: boolean }> {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let data: any
    try { data = JSON.parse(text) } catch { data = text }
    return { data, status: res.status, ok: res.ok }
  } catch (e: any) {
    return { data: null, status: 0, ok: false }
  }
}

export function summary(): void {
  console.log(`\n${'─'.repeat(44)}`)
  console.log(`  passed: ${passed}`)
  console.log(`  failed: ${failed}`)
  if (failures.length) {
    console.log('\n  failures:')
    for (const f of failures) console.log(f)
  }
  console.log(`${'─'.repeat(44)}\n`)
  if (failed > 0) process.exit(1)
}

export function cleanTestDb(): void {
  try { unlinkSync(TEST_DB) } catch {}
}
