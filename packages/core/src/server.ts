import { Hono } from 'hono'
import { initDb } from './db/init'
import { reconcile, startScheduler } from './services/scheduler'
import projectsRouter from './controllers/http/projects'
import tasksRouter from './controllers/http/tasks'
import promptsRouter from './controllers/http/prompts'

const PORT = parseInt(process.env.CONDUCTOR_PORT ?? '7762')

const app = new Hono()

app.route('/api/projects', projectsRouter)
app.route('/api/tasks', tasksRouter)
app.route('/api/prompts', promptsRouter)

app.get('/health', (c) => c.json({ ok: true, pid: process.pid }))

// Boot sequence
initDb()
reconcile()
startScheduler()

console.log(`conductor server listening on http://localhost:${PORT}`)

export default {
  port: PORT,
  fetch: app.fetch,
}
