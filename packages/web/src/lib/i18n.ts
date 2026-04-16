// Lightweight i18n — no dependencies
// Usage: import { useT, setLocale } from '../lib/i18n'
//        const t = useT()
//        t('save')  →  '保存' | 'Save'

import { useCallback, useEffect, useState } from 'react'

export type Locale = 'zh' | 'en'

const STORAGE_KEY = 'conductor_locale'

function detectLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
  if (stored === 'zh' || stored === 'en') return stored
  const lang = navigator.language.toLowerCase()
  return lang.startsWith('zh') ? 'zh' : 'en'
}

// ─── Translations ─────────────────────────────────────────────────────────────

const translations = {
  zh: {
    // Nav / layout
    conductor: 'Conductor',
    allProjects: '全部',
    newProject: '新建项目',
    archived: '已归档',
    collapsesidebar: '折叠侧边栏',
    expandSidebar: '展开侧边栏',
    projectSettings: '项目设置',
    systemPrompt: '系统 Prompt',

    // Task list
    newTask: '新建任务',
    manage: '批量管理',
    cancelSelect: '取消',
    deleteN: (n: number) => `删除 ${n} 项`,
    noTasks: '暂无任务',
    recurring: '周期任务',
    done: '已完成',
    noTime: '无时间',
    today: '今天',
    tomorrow: '明天',

    // Task status
    statusPending: '待执行',
    statusRunning: '执行中',
    statusDone: '完成',
    statusFailed: '失败',
    statusCancelled: '已取消',
    statusBlocked: '等待中',

    // Task detail tabs
    tabInfo: '详情',
    tabHistory: '历史',
    tabOps: '日志',

    // Task detail fields
    description: '描述',
    waitingInstructions: '完成说明',
    sourceTask: '来源任务',
    waitingFor: '等待',
    executor: '执行器',
    schedule: '调度',
    completionOutput: '完成输出',
    noRuns: '暂无执行记录',
    noLogs: '暂无执行日志',
    noOps: '暂无操作记录',

    // Task detail actions
    markDone: '完成',
    run: '执行',
    retry: '重试',
    delete: '删除',
    scheduleOn: '调度',
    pauseSchedule: '暂停调度',
    resumeSchedule: '恢复调度',

    // Task form
    newTaskTitle: '新建任务',
    editTaskTitle: '编辑任务',
    titleLabel: '标题',
    titlePlaceholder: '任务标题',
    descriptionLabel: '描述',
    descriptionPlaceholder: '可选描述',
    assigneeLabel: '执行者',
    assigneeHuman: '人类',
    assigneeHumanDesc: '手动完成',
    assigneeAI: 'AI',
    assigneeAIDesc: '自动执行',
    triggerLabel: '触发方式',
    triggerManual: '手动',
    triggerManualDesc: '按需触发',
    triggerScheduled: '定时',
    triggerScheduledDesc: '指定时间',
    triggerRecurring: '周期',
    triggerRecurringDesc: '重复执行',
    executionTimeLabel: '执行时间',
    recurringLabel: '执行周期',
    executorLabel: '执行器',
    executorNone: '无',
    executorAIPrompt: 'AI Prompt',
    executorScript: '脚本',
    executorHTTP: 'HTTP',
    promptPlaceholder: '输入 prompt，支持 {date} {taskTitle} {projectName} {lastOutput} 等占位符',
    modelPlaceholder: '模型（留空默认）',
    agentClaude: 'Claude',
    agentCodex: 'Codex',
    commandPlaceholder: 'Shell 命令，如 python3 ~/script.py',
    workDirPlaceholder: '工作目录（留空使用项目目录）',
    continueSession: '接续上次对话',
    reviewOnComplete: '完成后创建人工审核任务',
    cancel: '取消',
    save: '保存',
    create: '创建',
    saving: '保存中…',
    creating: '创建中…',

    // Scheduled picker
    todayAfternoon: '今天下午',
    todayEvening: '今天晚上',
    tomorrowMorning: '明天早上',
    tomorrowAfternoon: '明天下午',
    nextMonday: '下周一',
    customTime: '自定义',

    // Recurring presets
    daily: '每天',
    weekday: '工作日',
    weekly: '每周一',
    monthly: '每月1日',
    hourly: '每小时',
    custom: '自定义',
    executionHour: '执行时间',

    // Project settings
    projectName: '项目名称',
    projectNamePlaceholder: '项目名称',
    goalPlaceholder: '目标描述（注入 AI 上下文）',
    workDirLabel: '工作目录',
    workDirSettingsPlaceholder: '工作目录  ~/projects/xxx',
    projectPromptLabel: '系统 Prompt',
    projectPromptPlaceholder: '输入项目级 Prompt，留空则不设置',
    groupLabel: '所属分组',
    groupNone: '无分组',
    pinnedLabel: '置顶',
    pinnedSidebarLabel: '固定显示在侧边栏',
    archiveProject: '归档',
    unarchiveProject: '取消归档',
    deleteProject: '删除项目',
    confirmDeleteProject: (name: string) => `确定删除项目「${name}」？此操作不可撤销，项目下所有任务也会被删除。`,
    confirmArchiveProject: (name: string) => `归档项目「${name}」？`,
    confirmUnarchiveProject: (name: string) => `取消归档「${name}」？`,

    // Confirm dialog
    confirm: '确定',
    confirmDelete: '删除',
    confirmDeleteTask: (title: string) => `确定删除任务「${title}」？`,

    // New project dialog
    newProjectTitle: '新建项目',
    newProjectPlaceholder: '项目名称',
    newProjectGoalPlaceholder: '项目目标（可选）',
    newProjectWorkDirPlaceholder: '工作区目录（可选）~/projects/xxx',
    enableBrainLabel: '启用 AI 大脑',
    enableBrainDesc: '每 30 分钟自动规划任务',
    brainEnabled: 'AI 大脑已启用',
    enableBrain: '启用 AI 大脑',

    // System prompt dialog
    systemPromptTitle: '系统 Prompt',
    systemPromptSubtitle: '对所有 AI 任务生效，优先级最低',
    systemPromptPlaceholder: '输入系统级 Prompt，对所有项目的 AI 任务生效。留空则清除。',

    // Errors
    titleRequired: '标题不能为空',
    promptRequired: 'prompt 不能为空',
    commandRequired: '命令不能为空',
    urlRequired: 'URL 不能为空',
    timeRequired: '请选择执行时间',
    cronRequired: '请输入执行周期',
    projectNameRequired: '项目名称不能为空',
    saveFailed: '保存失败',

    // Mobile
    back: '返回',
    allTab: '全部',
    humanTab: '人类',
    aiTab: 'AI',

    // Loading
    loading: '加载中...',
    selectOrCreateProject: '选择或创建一个项目',

    // Toast
    markedDone: '已标记完成',
    doneOutputPlaceholder: '填写意见（可选）',
    aiTriggered: (names: string) => `已完成，AI 任务 ${names} 已触发`,

    // Ops labels
    opCreated: '创建',
    opTriggered: '触发',
    opStatusChanged: '状态变更',
    opDone: '完成',
    opCancelled: '取消',
    opReviewCreated: '创建审核任务',
    opUnblocked: '解除阻塞',
    opDeleted: '删除',

    // Run status
    runDone: '✓ 完成',
    runFailed: '✗ 失败',
    runRunning: '执行中',
    runCancelled: '已取消',

    // Run/log status
    skipped: '跳过',

    // Timeline / task list
    nextRunAt: '下次：',
    pendingN: (n: number) => `${n} 条待处理`,
    more: (n: number) => `更多 (${n})`,

    // Group management
    groupNamePlaceholder: '分组名称',
    newGroup: '新建分组',
    ungrouped: '未分组',
    groupSettings: '分组设置',
    deleteGroup: '删除分组',
    confirmDeleteGroup: (name: string) => `删除分组「${name}」？分组内项目将移到未分组。`,

    // Loading prompt
    loadingPrompt: '加载中...',

    // Auth / login
    loginSubtitle: '输入访问令牌以继续',
    accessToken: '访问令牌',
    tokenPlaceholder: '粘贴你的访问令牌',
    tokenRequired: '请输入访问令牌',
    tokenInvalid: '令牌无效，请检查后重试',
    verifying: '验证中…',
    login: '进入',
    tokenHint: '运行 conductor auth token 生成令牌',
  },

  en: {
    // Nav / layout
    conductor: 'Conductor',
    allProjects: 'All',
    newProject: 'New Project',
    archived: 'Archived',
    collapsesidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
    projectSettings: 'Project Settings',
    systemPrompt: 'System Prompt',

    // Task list
    newTask: 'New Task',
    manage: 'Manage',
    cancelSelect: 'Cancel',
    deleteN: (n: number) => `Delete ${n}`,
    noTasks: 'No tasks',
    recurring: 'Recurring',
    done: 'Done',
    noTime: 'No date',
    today: 'Today',
    tomorrow: 'Tomorrow',

    // Task status
    statusPending: 'Pending',
    statusRunning: 'Running',
    statusDone: 'Done',
    statusFailed: 'Failed',
    statusCancelled: 'Cancelled',
    statusBlocked: 'Blocked',

    // Task detail tabs
    tabInfo: 'Info',
    tabHistory: 'History',
    tabOps: 'Log',

    // Task detail fields
    description: 'Description',
    waitingInstructions: 'Instructions',
    sourceTask: 'Source task',
    waitingFor: 'Waiting for',
    executor: 'Executor',
    schedule: 'Schedule',
    completionOutput: 'Output',
    noRuns: 'No runs yet',
    noLogs: 'No logs yet',
    noOps: 'No activity yet',

    // Task detail actions
    markDone: 'Done',
    run: 'Run',
    retry: 'Retry',
    delete: 'Delete',
    scheduleOn: 'Schedule',
    pauseSchedule: 'Pause schedule',
    resumeSchedule: 'Resume schedule',

    // Task form
    newTaskTitle: 'New Task',
    editTaskTitle: 'Edit Task',
    titleLabel: 'Title',
    titlePlaceholder: 'Task title',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'Optional description',
    assigneeLabel: 'Assignee',
    assigneeHuman: 'Human',
    assigneeHumanDesc: 'Manual',
    assigneeAI: 'AI',
    assigneeAIDesc: 'Automated',
    triggerLabel: 'Trigger',
    triggerManual: 'Manual',
    triggerManualDesc: 'On demand',
    triggerScheduled: 'Scheduled',
    triggerScheduledDesc: 'At a time',
    triggerRecurring: 'Recurring',
    triggerRecurringDesc: 'Repeating',
    executionTimeLabel: 'Run at',
    recurringLabel: 'Recurrence',
    executorLabel: 'Executor',
    executorNone: 'None',
    executorAIPrompt: 'AI Prompt',
    executorScript: 'Script',
    executorHTTP: 'HTTP',
    promptPlaceholder: 'Enter prompt. Supports {date} {taskTitle} {projectName} {lastOutput}',
    modelPlaceholder: 'Model (leave blank for default)',
    agentClaude: 'Claude',
    agentCodex: 'Codex',
    commandPlaceholder: 'Shell command, e.g. python3 ~/script.py',
    workDirPlaceholder: 'Working directory (defaults to project dir)',
    continueSession: 'Continue last session',
    reviewOnComplete: 'Create review task on completion',
    cancel: 'Cancel',
    save: 'Save',
    create: 'Create',
    saving: 'Saving…',
    creating: 'Creating…',

    // Scheduled picker
    todayAfternoon: 'This afternoon',
    todayEvening: 'This evening',
    tomorrowMorning: 'Tomorrow morning',
    tomorrowAfternoon: 'Tomorrow afternoon',
    nextMonday: 'Next Monday',
    customTime: 'Custom',

    // Recurring presets
    daily: 'Daily',
    weekday: 'Weekdays',
    weekly: 'Weekly (Mon)',
    monthly: 'Monthly (1st)',
    hourly: 'Hourly',
    custom: 'Custom',
    executionHour: 'At hour',

    // Project settings
    projectName: 'Project name',
    projectNamePlaceholder: 'Project name',
    goalPlaceholder: 'Goal description (injected into AI context)',
    workDirLabel: 'Working directory',
    workDirSettingsPlaceholder: '~/projects/xxx',
    projectPromptLabel: 'System Prompt',
    projectPromptPlaceholder: 'Project-level prompt. Leave blank to remove.',
    groupLabel: 'Group',
    groupNone: 'No group',
    pinnedLabel: 'Pinned',
    pinnedSidebarLabel: 'Pin to sidebar',
    archiveProject: 'Archive',
    unarchiveProject: 'Unarchive',
    deleteProject: 'Delete project',
    confirmDeleteProject: (name: string) => `Delete project "${name}"? This cannot be undone. All tasks will be deleted.`,
    confirmArchiveProject: (name: string) => `Archive "${name}"?`,
    confirmUnarchiveProject: (name: string) => `Unarchive "${name}"?`,

    // Confirm dialog
    confirm: 'Confirm',
    confirmDelete: 'Delete',
    confirmDeleteTask: (title: string) => `Delete task "${title}"?`,

    // New project dialog
    newProjectTitle: 'New Project',
    newProjectPlaceholder: 'Project name',
    newProjectGoalPlaceholder: 'Goal (optional)',
    newProjectWorkDirPlaceholder: 'Working directory (optional) ~/projects/xxx',
    enableBrainLabel: 'Enable AI Brain',
    enableBrainDesc: 'Auto-plans tasks every 30 minutes',
    brainEnabled: 'AI Brain enabled',
    enableBrain: 'Enable AI Brain',

    // System prompt dialog
    systemPromptTitle: 'System Prompt',
    systemPromptSubtitle: 'Applied to all AI tasks, lowest priority',
    systemPromptPlaceholder: 'Enter system-level prompt for all projects. Leave blank to clear.',

    // Errors
    titleRequired: 'Title is required',
    promptRequired: 'Prompt is required',
    commandRequired: 'Command is required',
    urlRequired: 'URL is required',
    timeRequired: 'Please select a time',
    cronRequired: 'Please enter a recurrence',
    projectNameRequired: 'Project name is required',
    saveFailed: 'Save failed',

    // Mobile
    back: 'Back',
    allTab: 'All',
    humanTab: 'Human',
    aiTab: 'AI',

    // Loading
    loading: 'Loading...',
    selectOrCreateProject: 'Select or create a project',

    // Toast
    markedDone: 'Marked as done',
    doneOutputPlaceholder: 'Add a note (optional)',
    aiTriggered: (names: string) => `Done — AI task ${names} triggered`,

    // Ops labels
    opCreated: 'Created',
    opTriggered: 'Triggered',
    opStatusChanged: 'Status changed',
    opDone: 'Done',
    opCancelled: 'Cancelled',
    opReviewCreated: 'Review task created',
    opUnblocked: 'Unblocked',
    opDeleted: 'Deleted',

    // Run status
    runDone: '✓ Done',
    runFailed: '✗ Failed',
    runRunning: 'Running',
    runCancelled: 'Cancelled',

    // Run/log status
    skipped: 'Skipped',

    // Timeline / task list
    nextRunAt: 'Next: ',
    pendingN: (n: number) => `${n} pending`,
    more: (n: number) => `More (${n})`,

    // Group management
    groupNamePlaceholder: 'Group name',
    newGroup: 'New group',
    ungrouped: 'Ungrouped',
    groupSettings: 'Group settings',
    deleteGroup: 'Delete group',
    confirmDeleteGroup: (name: string) => `Delete group "${name}"? Projects will be moved to ungrouped.`,

    // Loading prompt
    loadingPrompt: 'Loading...',

    // Auth / login
    loginSubtitle: 'Enter your access token to continue',
    accessToken: 'Access token',
    tokenPlaceholder: 'Paste your access token',
    tokenRequired: 'Please enter an access token',
    tokenInvalid: 'Invalid token, please check and try again',
    verifying: 'Verifying…',
    login: 'Continue',
    tokenHint: 'Run conductor auth token to generate a token',
  },
} as const

type Translations = typeof translations.zh
export type TKey = keyof Translations

// ─── State ───────────────────────────────────────────────────────────────────

let _locale: Locale = detectLocale()
const _listeners = new Set<() => void>()

export function getLocale(): Locale {
  return _locale
}

export function setLocale(locale: Locale) {
  _locale = locale
  localStorage.setItem(STORAGE_KEY, locale)
  _listeners.forEach(fn => fn())
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLocale(): [Locale, (l: Locale) => void] {
  const [locale, setLocal] = useState<Locale>(_locale)

  useEffect(() => {
    const handler = () => setLocal(_locale)
    _listeners.add(handler)
    return () => { _listeners.delete(handler) }
  }, [])

  const toggle = useCallback((l: Locale) => setLocale(l), [])
  return [locale, toggle]
}

export function useT() {
  const [locale] = useLocale()
  return useCallback(
    <K extends TKey>(key: K, ...args: Translations[K] extends (...a: infer A) => string ? A : never[]): string => {
      const val = translations[locale][key] as Translations[K]
      if (typeof val === 'function') {
        return (val as (...a: unknown[]) => string)(...args)
      }
      return val as string
    },
    [locale]
  )
}

// Non-hook version for use outside components
export function t<K extends TKey>(key: K, ...args: Translations[K] extends (...a: infer A) => string ? A : never[]): string {
  const val = translations[_locale][key] as Translations[K]
  if (typeof val === 'function') {
    return (val as (...a: unknown[]) => string)(...args)
  }
  return val as string
}
