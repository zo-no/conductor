import { Hono } from 'hono'
import {
  listProjects, getProject, createProject, updateProject,
  deleteProject, archiveProject, unarchiveProject,
} from '../../models/projects'

const app = new Hono()

app.get('/', (c) => {
  return c.json(listProjects())
})

app.post('/', async (c) => {
  const body = await c.req.json()
  if (!body.name) return c.json({ error: 'name is required' }, 400)
  const project = createProject({ name: body.name, goal: body.goal, workDir: body.workDir })
  return c.json(project, 201)
})

app.get('/:id', (c) => {
  const project = getProject(c.req.param('id'))
  if (!project) return c.json({ error: 'not found' }, 404)
  return c.json(project)
})

app.patch('/:id', async (c) => {
  const body = await c.req.json()
  const project = updateProject(c.req.param('id'), body)
  if (!project) return c.json({ error: 'not found' }, 404)
  return c.json(project)
})

app.delete('/:id', (c) => {
  const ok = deleteProject(c.req.param('id'))
  if (!ok) return c.json({ error: 'not found' }, 404)
  return c.json({ ok: true })
})

app.post('/:id/archive', (c) => {
  const project = archiveProject(c.req.param('id'))
  if (!project) return c.json({ error: 'not found' }, 404)
  return c.json(project)
})

app.post('/:id/unarchive', (c) => {
  const project = unarchiveProject(c.req.param('id'))
  if (!project) return c.json({ error: 'not found' }, 404)
  return c.json(project)
})

export default app
