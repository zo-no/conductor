/**
 * SSE event bus tests
 */
import { assert, section, summary } from './helpers'
import { subscribe, emit } from '../src/services/events'

console.log('\n=== event bus tests ===')

// ── basic subscribe/emit ──────────────────────────────────────────────────────
section('subscribe / emit')

{
  const received: any[] = []
  const unsub = subscribe(e => received.push(e))

  emit({ type: 'task_created', data: { taskId: 'task_1', projectId: 'proj_1' } })
  assert('subscriber receives event', received.length === 1)
  assert('event type correct', received[0].type === 'task_created')
  assert('event data correct', received[0].data.taskId === 'task_1')

  unsub()
  emit({ type: 'task_updated', data: { taskId: 'task_2', projectId: 'proj_1' } })
  assert('no events after unsubscribe', received.length === 1)
}

// ── multiple subscribers ──────────────────────────────────────────────────────
section('multiple subscribers')

{
  const a: any[] = []
  const b: any[] = []
  const unsubA = subscribe(e => a.push(e))
  const unsubB = subscribe(e => b.push(e))

  emit({ type: 'task_deleted', data: { taskId: 'task_3', projectId: 'proj_2' } })
  assert('subscriber A receives event', a.length === 1)
  assert('subscriber B receives event', b.length === 1)

  unsubA()
  emit({ type: 'task_updated', data: { taskId: 'task_4', projectId: 'proj_2' } })
  assert('A stopped after unsub', a.length === 1)
  assert('B still receives after A unsub', b.length === 2)

  unsubB()
}

// ── all event types ───────────────────────────────────────────────────────────
section('all event types')

{
  const types: string[] = []
  const unsub = subscribe(e => types.push(e.type))

  emit({ type: 'task_created', data: { taskId: 'x', projectId: 'y' } })
  emit({ type: 'task_updated', data: { taskId: 'x', projectId: 'y' } })
  emit({ type: 'task_deleted', data: { taskId: 'x', projectId: 'y' } })

  assert('task_created emitted', types.includes('task_created'))
  assert('task_updated emitted', types.includes('task_updated'))
  assert('task_deleted emitted', types.includes('task_deleted'))
  assert('all 3 event types received', types.length === 3)

  unsub()
}

// ── subscriber error isolation ────────────────────────────────────────────────
section('subscriber error isolation')

{
  const good: any[] = []
  const unsubBad = subscribe(() => { throw new Error('subscriber crash') })
  const unsubGood = subscribe(e => good.push(e))

  // Should not throw even if a subscriber throws
  try {
    emit({ type: 'task_updated', data: { taskId: 'x', projectId: 'y' } })
    assert('emit does not throw when subscriber crashes', true)
  } catch {
    assert('emit does not throw when subscriber crashes', false)
  }

  assert('good subscriber still receives event', good.length === 1)

  unsubBad()
  unsubGood()
}

// ── no subscribers ────────────────────────────────────────────────────────────
section('emit with no subscribers')

{
  try {
    emit({ type: 'task_created', data: { taskId: 'x', projectId: 'y' } })
    assert('emit with no subscribers does not throw', true)
  } catch {
    assert('emit with no subscribers does not throw', false)
  }
}

summary()
