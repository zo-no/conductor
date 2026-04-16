import { readFileSync } from 'fs'
import { join } from 'path'
import { createTask, listTasks } from '../models/tasks'
import { getProject } from '../models/projects'
import { createTaskOp } from '../models/task-ops'
import type { Task } from '@conductor/types'

const BRAIN_PROMPT_PATH = join(__dirname, '../prompts/brain-task.md')
const BRAIN_CRON = '*/30 * * * *'
const BRAIN_TITLE = '🧠 AI 大脑'

function loadBrainPrompt(): string {
  try {
    const raw = readFileSync(BRAIN_PROMPT_PATH, 'utf-8')
    // Strip the markdown header/meta (everything before the first blank line after ---)
    const lines = raw.split('\n')
    const separatorIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
    if (separatorIdx !== -1) {
      return lines.slice(separatorIdx + 1).join('\n').trim()
    }
    return raw.trim()
  } catch {
    return `你是项目 "{projectName}" 的 AI 项目经理，工作区在 {workDir}。

项目目标：
{projectGoal}

每次运行时先运行 conductor help-ai 了解可用命令，再读取项目状态，然后决定下一步（0-3个任务）。`
  }
}

/** Find existing brain task for a project, or null if none. */
export function getBrainTask(projectId: string): Task | null {
  const tasks = listTasks({ projectId, kind: 'recurring', assignee: 'ai' })
  return tasks.find(t => t.title === BRAIN_TITLE) ?? null
}

/**
 * Create a brain task for a project.
 * Throws if a brain task already exists (use getBrainTask to check first).
 */
export function createBrainTask(projectId: string): Task {
  const project = getProject(projectId)
  if (!project) throw new Error(`project ${projectId} not found`)

  // Idempotency: return existing brain if already created
  const existing = getBrainTask(projectId)
  if (existing) return existing

  const prompt = loadBrainPrompt()

  const task = createTask({
    projectId,
    title: BRAIN_TITLE,
    assignee: 'ai',
    kind: 'recurring',
    createdBy: 'human',
    enabled: false,
    executor: {
      kind: 'ai_prompt',
      prompt,
    },
    scheduleConfig: {
      kind: 'recurring',
      cron: BRAIN_CRON,
    },
  })

  createTaskOp({
    taskId: task.id,
    op: 'created',
    fromStatus: 'pending',
    toStatus: 'pending',
    actor: 'human',
    note: 'brain task initialized',
  })

  return task
}
