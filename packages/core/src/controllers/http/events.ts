import { Hono } from 'hono'
import { subscribe } from '../../services/events'

const app = new Hono()

// GET /api/events  — SSE stream
app.get('/', (c) => {
  const { projectId } = c.req.query()

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()

      const send = (data: string) => {
        try {
          controller.enqueue(enc.encode(`data: ${data}\n\n`))
        } catch {}
      }

      // Send initial heartbeat
      send(JSON.stringify({ type: 'connected' }))

      const unsub = subscribe((event) => {
        // run_line events have taskId but not projectId — always pass through
        // other events filter by projectId if provided
        if (event.type !== 'run_line') {
          if (projectId && event.data.projectId !== projectId) return
        }
        send(JSON.stringify(event))
      })

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 30_000)

      // Cleanup on close
      c.req.raw.signal.addEventListener('abort', () => {
        unsub()
        clearInterval(heartbeat)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
})

export default app
