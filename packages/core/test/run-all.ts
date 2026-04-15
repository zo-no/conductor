#!/usr/bin/env bun
/**
 * Run all test suites sequentially
 * Usage: bun packages/core/test/run-all.ts
 */
import { spawnSync } from 'child_process'

const suites = [
  { name: 'models', file: 'packages/core/test/models.test.ts' },
  { name: 'executor', file: 'packages/core/test/executor.test.ts' },
  { name: 'events', file: 'packages/core/test/events.test.ts' },
  { name: 'prompt', file: 'packages/core/test/prompt.test.ts' },
  { name: 'scheduler', file: 'packages/core/test/scheduler.test.ts' },
  { name: 'http', file: 'packages/core/test/http.test.ts' },
  { name: 'cli', file: 'packages/core/test-cli.ts' },
]

let allPassed = true

for (const suite of suites) {
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`  Running: ${suite.name}`)
  console.log(`${'═'.repeat(50)}`)

  const result = spawnSync('bun', [suite.file], {
    stdio: 'inherit',
    env: { ...process.env },
  })

  if (result.status !== 0) {
    allPassed = false
    console.error(`\n  ✗ Suite "${suite.name}" failed (exit ${result.status})\n`)
  }
}

console.log(`\n${'═'.repeat(50)}`)
if (allPassed) {
  console.log('  All suites passed ✓')
  console.log(`${'═'.repeat(50)}\n`)
} else {
  console.log('  Some suites failed ✗')
  console.log(`${'═'.repeat(50)}\n`)
  process.exit(1)
}
