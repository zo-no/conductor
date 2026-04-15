import { Hono } from 'hono'
import { getTask } from '../../models/tasks'
import { listRuns, getRun, getSpoolLines } from '../../models/task-runs'

const app = new Hono()

// GET /api/tasks/:id/runs — list all runs for a task
app.get('/', (c) => {
  const taskId = c.req.param('id')
  const task = getTask(taskId)
  if (!task) return c.json({ error: 'not found' }, 404)
  return c.json(listRuns(taskId))
})

// GET /api/tasks/:id/runs/:runId/spool — get all spool lines for a run
app.get('/:runId/spool', (c) => {
  const taskId = c.req.param('id')
  const runId = c.req.param('runId')
  const task = getTask(taskId)
  if (!task) return c.json({ error: 'task not found' }, 404)
  const run = getRun(runId)
  if (!run || run.taskId !== taskId) return c.json({ error: 'run not found' }, 404)
  return c.json(getSpoolLines(runId))
})

export default app
