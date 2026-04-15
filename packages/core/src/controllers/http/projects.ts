import { Hono } from 'hono'
import {
  listProjects, getProject, createProject, updateProject,
  deleteProject, archiveProject, unarchiveProject, isDefaultProject,
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
  const id = c.req.param('id')
  const body = await c.req.json()
  // Protect default project name
  if (isDefaultProject(id) && body.name && body.name !== '日常事务') {
    return c.json({ error: '默认项目名称不可修改' }, 400)
  }
  const project = updateProject(id, body)
  if (!project) return c.json({ error: 'not found' }, 404)
  return c.json(project)
})

app.delete('/:id', (c) => {
  const id = c.req.param('id')
  if (isDefaultProject(id)) return c.json({ error: '默认项目不可删除' }, 400)
  const ok = deleteProject(id)
  if (!ok) return c.json({ error: 'not found' }, 404)
  return c.json({ ok: true })
})

app.post('/:id/archive', (c) => {
  const id = c.req.param('id')
  if (isDefaultProject(id)) return c.json({ error: '默认项目不可归档' }, 400)
  const project = archiveProject(id)
  if (!project) return c.json({ error: 'not found' }, 404)
  return c.json(project)
})

app.post('/:id/unarchive', (c) => {
  const project = unarchiveProject(c.req.param('id'))
  if (!project) return c.json({ error: 'not found' }, 404)
  return c.json(project)
})

export default app
