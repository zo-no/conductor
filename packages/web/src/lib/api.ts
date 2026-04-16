import type { Project, Task, TaskLog, TaskOp, ProjectGroup, ProjectsView } from '@conductor/types'

export interface TaskRun {
  id: string
  taskId: string
  status: 'running' | 'done' | 'failed' | 'cancelled'
  triggeredBy: string
  startedAt: string
  completedAt?: string
  error?: string
}

export interface SpoolLine {
  id: number
  runId: string
  ts: string
  line: string
}

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? res.statusText)
  }
  return res.json()
}

export interface SystemPrompt {
  key: string
  content: string
  updatedAt: string
}

// Projects
export const api = {
  projects: {
    list: () => request<Project[]>('/projects'),
    view: () => request<ProjectsView>('/view/projects'),
    get: (id: string) => request<Project>(`/projects/${id}`),
    create: (data: { name: string; goal?: string; workDir?: string; groupId?: string; pinned?: boolean }) =>
      request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Project> & { groupId?: string | null }) =>
      request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ ok: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
    archive: (id: string) => request<Project>(`/projects/${id}/archive`, { method: 'POST' }),
    unarchive: (id: string) => request<Project>(`/projects/${id}/unarchive`, { method: 'POST' }),
    reorderUngrouped: (ids: string[]) =>
      request<{ ok: boolean }>('/ungrouped/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
  },

  groups: {
    list: () => request<(ProjectGroup & { projects: Project[] })[]>('/groups'),
    get: (id: string) => request<ProjectGroup & { projects: Project[] }>(`/groups/${id}`),
    create: (data: { name: string; collapsed?: boolean; createdBy?: string }) =>
      request<ProjectGroup>('/groups', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; collapsed?: boolean }) =>
      request<ProjectGroup>(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ ok: boolean }>(`/groups/${id}`, { method: 'DELETE' }),
    reorder: (ids: string[]) =>
      request<{ ok: boolean }>('/groups/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
    reorderProjects: (groupId: string, ids: string[]) =>
      request<{ ok: boolean }>(`/groups/${groupId}/projects/reorder`, { method: 'POST', body: JSON.stringify({ ids }) }),
  },

  prompts: {
    getSystem: () => request<SystemPrompt | null>('/prompts/system').catch(() => null),
    setSystem: (content: string) =>
      request<SystemPrompt>('/prompts/system', { method: 'PATCH', body: JSON.stringify({ content }) }),
    getProject: (projectId: string) =>
      request<SystemPrompt | null>(`/prompts/project/${projectId}`).catch(() => null),
    setProject: (projectId: string, content: string) =>
      request<SystemPrompt>(`/prompts/project/${projectId}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
    deleteProject: (projectId: string) =>
      request<{ ok: boolean }>(`/prompts/project/${projectId}`, { method: 'DELETE' }),
  },

  tasks: {
    list: (params?: { projectId?: string; assignee?: string; status?: string }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString()
      return request<Task[]>(`/tasks${q ? `?${q}` : ''}`)
    },
    get: (id: string) => request<Task>(`/tasks/${id}`),
    create: (data: Partial<Task> & { projectId: string; title: string }) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Task>) =>
      request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ ok: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
    done: (id: string, output?: string) =>
      request<Task>(`/tasks/${id}/done`, { method: 'POST', body: JSON.stringify({ output }) }),
    cancel: (id: string) => request<Task>(`/tasks/${id}/cancel`, { method: 'POST' }),
    run: (id: string) => request<{ ok: boolean }>(`/tasks/${id}/run`, { method: 'POST' }),
    logs: (id: string) => request<TaskLog[]>(`/tasks/${id}/logs`),
    ops: (id: string) => request<TaskOp[]>(`/tasks/${id}/ops`),
    runs: (id: string) => request<TaskRun[]>(`/tasks/${id}/runs`),
    runSpool: (id: string, runId: string) => request<SpoolLine[]>(`/tasks/${id}/runs/${runId}/spool`),
  },
}
