import { Hono } from 'hono'
import {
  getSystemPrompt, setSystemPrompt, deleteSystemPrompt,
  getProjectPromptKey,
} from '../../models/system-prompts'

const app = new Hono()

app.get('/system', (c) => {
  const prompt = getSystemPrompt('default')
  if (!prompt) return c.json({ error: 'not found' }, 404)
  return c.json(prompt)
})

app.patch('/system', async (c) => {
  const body = await c.req.json()
  if (!body.content) return c.json({ error: 'content is required' }, 400)
  return c.json(setSystemPrompt('default', body.content))
})

app.get('/project/:id', (c) => {
  const key = getProjectPromptKey(c.req.param('id'))
  const prompt = getSystemPrompt(key)
  if (!prompt) return c.json({ error: 'not found' }, 404)
  return c.json(prompt)
})

app.patch('/project/:id', async (c) => {
  const body = await c.req.json()
  if (!body.content) return c.json({ error: 'content is required' }, 400)
  const key = getProjectPromptKey(c.req.param('id'))
  return c.json(setSystemPrompt(key, body.content))
})

app.delete('/project/:id', (c) => {
  const key = getProjectPromptKey(c.req.param('id'))
  const ok = deleteSystemPrompt(key)
  if (!ok) return c.json({ error: 'not found' }, 404)
  return c.json({ ok: true })
})

export default app
