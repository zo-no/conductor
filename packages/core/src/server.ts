import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { initDb } from './db/init'
import { reconcile, startScheduler } from './services/scheduler'
import { bootstrap } from './services/bootstrap'
import projectsRouter from './controllers/http/projects'
import groupsRouter, { viewProjectsRouter, ungroupedReorderRouter } from './controllers/http/groups'
import tasksRouter from './controllers/http/tasks'
import promptsRouter from './controllers/http/prompts'
import eventsRouter from './controllers/http/events'
import runsRouter from './controllers/http/runs'
import { join } from 'path'

const PORT = parseInt(process.env.CONDUCTOR_PORT ?? '7762')

// Resolve web dist relative to this file's location at build time,
// or fall back to the monorepo path for development.
const WEB_DIST = process.env.CONDUCTOR_WEB_DIST
  ?? join(import.meta.dir, '../../web/dist')

const app = new Hono()

app.route('/api/projects', projectsRouter)
app.route('/api/groups', groupsRouter)
app.route('/api/view/projects', viewProjectsRouter)
app.route('/api/ungrouped/reorder', ungroupedReorderRouter)
app.route('/api/tasks', tasksRouter)
app.route('/api/tasks/:id/runs', runsRouter)
app.route('/api/prompts', promptsRouter)
app.route('/api/events', eventsRouter)

app.get('/health', (c) => c.json({ ok: true, pid: process.pid }))

// Serve built web UI (production / single-port mode).
// Only active when the dist directory exists; dev mode uses Vite on port 5173.
import { existsSync } from 'fs'
if (existsSync(WEB_DIST)) {
  app.use('/*', serveStatic({ root: WEB_DIST }))
  // SPA fallback — unknown paths return index.html
  app.get('/*', async (c) => {
    return c.html(await Bun.file(join(WEB_DIST, 'index.html')).text())
  })
}

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
