import { Hono } from 'hono'
import {
  listGroups, getGroup, createGroup, updateGroup, deleteGroup,
  reorderGroups, reorderProjectsInGroup, getProjectsView,
} from '../../models/project-groups'
import { updateProject } from '../../models/projects'

const app = new Hono()

// GET /api/view/projects — full nested view (groups + ungrouped)
// Mounted separately in server.ts at /api/view/projects
export const viewProjectsRouter = new Hono()
viewProjectsRouter.get('/', (c) => c.json(getProjectsView()))

// GET /api/groups
app.get('/', (c) => {
  const groups = listGroups()
  const view = getProjectsView()
  // Attach projects to each group
  return c.json(view.groups)
})

// POST /api/groups
app.post('/', async (c) => {
  const body = await c.req.json()
  if (!body.name) return c.json({ error: 'name is required' }, 400)
  const group = createGroup({
    name: body.name,
    collapsed: body.collapsed ?? false,
    createdBy: body.createdBy ?? 'human',
  })
  return c.json(group, 201)
})

// GET /api/groups/:id
app.get('/:id', (c) => {
  const view = getProjectsView()
  const group = view.groups.find(g => g.id === c.req.param('id'))
  if (!group) return c.json({ error: 'not found' }, 404)
  return c.json(group)
})

// PATCH /api/groups/:id
app.patch('/:id', async (c) => {
  const body = await c.req.json()
  const group = updateGroup(c.req.param('id'), {
    name: body.name,
    collapsed: body.collapsed,
  })
  if (!group) return c.json({ error: 'not found' }, 404)
  return c.json(group)
})

// DELETE /api/groups/:id
app.delete('/:id', (c) => {
  const ok = deleteGroup(c.req.param('id'))
  if (!ok) return c.json({ error: 'not found' }, 404)
  return c.json({ ok: true })
})

// POST /api/groups/reorder — reorder all groups
app.post('/reorder', async (c) => {
  const body = await c.req.json()
  if (!Array.isArray(body.ids)) return c.json({ error: 'ids array required' }, 400)
  reorderGroups(body.ids)
  return c.json({ ok: true })
})

// POST /api/groups/:id/projects/reorder — reorder projects within a group
app.post('/:id/projects/reorder', async (c) => {
  const groupId = c.req.param('id')
  const body = await c.req.json()
  if (!Array.isArray(body.ids)) return c.json({ error: 'ids array required' }, 400)
  reorderProjectsInGroup(groupId, body.ids)
  return c.json({ ok: true })
})

// POST /api/ungrouped/reorder — reorder ungrouped projects
export const ungroupedReorderRouter = new Hono()
ungroupedReorderRouter.post('/', async (c) => {
  const body = await c.req.json()
  if (!Array.isArray(body.ids)) return c.json({ error: 'ids array required' }, 400)
  reorderProjectsInGroup(null, body.ids)
  return c.json({ ok: true })
})

export default app
