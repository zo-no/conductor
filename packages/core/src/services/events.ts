// Simple in-process event bus for SSE clients

export type ConductorEvent =
  | { type: 'task_updated'; data: { taskId: string; projectId: string } }
  | { type: 'task_created'; data: { taskId: string; projectId: string } }
  | { type: 'task_deleted'; data: { taskId: string; projectId: string } }

type Listener = (event: ConductorEvent) => void

const listeners = new Set<Listener>()

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emit(event: ConductorEvent): void {
  for (const fn of listeners) {
    try { fn(event) } catch {}
  }
}
