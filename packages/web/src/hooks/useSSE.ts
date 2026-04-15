import { useEffect } from 'react'

export type SSEEvent =
  | { type: 'task_updated' | 'task_created' | 'task_deleted' | 'connected'; data?: { taskId: string; projectId: string } }
  | { type: 'run_line'; data: { taskId: string; runId: string; line: string; ts: string } }

export function useSSE(projectId: string | null, onEvent: (e: SSEEvent) => void) {
  useEffect(() => {
    if (!projectId) return

    const url = `/api/events?projectId=${projectId}`
    const es = new EventSource(url)

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as SSEEvent
        onEvent(event)
      } catch {}
    }

    es.onerror = () => {
      // Browser auto-reconnects EventSource
    }

    return () => es.close()
  }, [projectId, onEvent])
}
