import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { initDb } from './db/init'
import { reconcile, startScheduler } from './services/scheduler'
import { bootstrap } from './services/bootstrap'
import { authMiddleware, isAuthEnabled } from './services/auth'
import projectsRouter from './controllers/http/projects'
import groupsRouter, { viewProjectsRouter, ungroupedReorderRouter } from './controllers/http/groups'
import tasksRouter from './controllers/http/tasks'
import promptsRouter from './controllers/http/prompts'
import eventsRouter from './controllers/http/events'
import runsRouter from './controllers/http/runs'

const PORT = parseInt(process.env.CONDUCTOR_PORT ?? '7762')

const app = new Hono()

// CORS — allow any origin so the frontend can be hosted anywhere
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

// Auth middleware — protects all /api/* routes
app.use('/api/*', authMiddleware)

app.route('/api/projects', projectsRouter)
app.route('/api/groups', groupsRouter)
app.route('/api/view/projects', viewProjectsRouter)
app.route('/api/ungrouped/reorder', ungroupedReorderRouter)
app.route('/api/tasks', tasksRouter)
app.route('/api/tasks/:id/runs', runsRouter)
app.route('/api/prompts', promptsRouter)
app.route('/api/events', eventsRouter)

app.get('/health', (c) => c.json({ ok: true, pid: process.pid }))

// Auth status endpoint (public — used by web UI to check if auth is required)
app.get('/auth/status', (c) => c.json({ enabled: isAuthEnabled() }))

// Boot sequence
initDb()
bootstrap()
reconcile()
startScheduler()

console.log(`conductor server listening on http://localhost:${PORT}`)

export default {
  port: PORT,
  fetch: app.fetch,
}
