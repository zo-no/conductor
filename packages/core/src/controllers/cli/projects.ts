import { Command } from 'commander'
import * as readline from 'readline'
import {
  listProjects, getProject, createProject, updateProject,
  deleteProject, archiveProject, unarchiveProject,
} from '../../models/projects'
import { createBrainTask } from '../../services/brain'
import { updateTask } from '../../models/tasks'
import { print, error } from './output'
import { initDb } from '../../db/init'

// Note: CLI brain add writes to DB only — cron fires when daemon is running

function ensureDb(): void { initDb() }

export function registerProjectCommands(program: Command): void {
  const proj = program.command('project').description('manage projects')

  proj
    .command('list')
    .description('list all projects')
    .option('--json', 'output as JSON')
    .action((opts) => {
      ensureDb()
      print(listProjects(), opts.json)
    })

  proj
    .command('get <id>')
    .description('get a project')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const project = getProject(id)
      if (!project) error(`project ${id} not found`)
      print(project, opts.json)
    })

  proj
    .command('create')
    .description('create a project')
    .requiredOption('--name <name>', 'project name')
    .option('--goal <goal>', 'project goal')
    .option('--work-dir <dir>', 'working directory for AI tasks')
    .option('--group <groupId>', 'assign to a group')
    .option('--order <n>', 'display order within group', parseInt)
    .option('--no-pin', 'create as unpinned (hidden in sidebar by default)')
    .option('--json', 'output as JSON')
    .action((opts) => {
      ensureDb()
      const project = createProject({
        name: opts.name,
        goal: opts.goal,
        workDir: opts.workDir,
        groupId: opts.group,
        pinned: opts.pin !== false,
      })
      createBrainTask(project.id)
      print(project, opts.json)
    })

  proj
    .command('update <id>')
    .description('update a project')
    .option('--name <name>')
    .option('--goal <goal>')
    .option('--work-dir <dir>')
    .option('--group <groupId>', 'assign to a group')
    .option('--no-group', 'remove from group (move to ungrouped)')
    .option('--order <n>', 'display order within group', parseInt)
    .option('--pin', 'set pinned=true (show in sidebar)')
    .option('--no-pin', 'set pinned=false (collapse to "more")')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const updates: Parameters<typeof updateProject>[1] = {}
      if (opts.name)     updates.name = opts.name
      if (opts.goal)     updates.goal = opts.goal
      if (opts.workDir)  updates.workDir = opts.workDir
      if (opts.group)    updates.groupId = opts.group
      if (opts.noGroup)  updates.groupId = null
      if (opts.order !== undefined) updates.order = opts.order
      if (opts.pin === true)  updates.pinned = true
      if (opts.pin === false) updates.pinned = false
      const project = updateProject(id, updates)
      if (!project) error(`project ${id} not found`)
      print(project, opts.json)
    })

  proj
    .command('delete <id>')
    .description('delete a project')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const ok = deleteProject(id)
      if (!ok) error(`project ${id} not found`)
      print({ ok: true }, opts.json)
    })

  proj
    .command('archive <id>')
    .description('archive a project')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const project = archiveProject(id)
      if (!project) error(`project ${id} not found`)
      print(project, opts.json)
    })

  proj
    .command('unarchive <id>')
    .description('unarchive a project')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const project = unarchiveProject(id)
      if (!project) error(`project ${id} not found`)
      print(project, opts.json)
    })

  proj
    .command('init')
    .description('interactively create a project with optional AI brain')
    .action(async () => {
      ensureDb()
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      const ask = (q: string): Promise<string> => new Promise(resolve => rl.question(q, resolve))

      console.log('\n🚀 创建新项目\n')

      const name = (await ask('项目名称: ')).trim()
      if (!name) { rl.close(); error('项目名称不能为空') }

      const goal = (await ask('项目目标（可选，直接回车跳过）: ')).trim()
      const workDir = (await ask('工作区目录（可选，直接回车跳过）: ')).trim()
      const brainAnswer = (await ask('是否启用 AI 大脑？每 30 分钟自动规划任务 (y/N): ')).trim().toLowerCase()
      rl.close()

      const project = createProject({
        name,
        goal: goal || undefined,
        workDir: workDir || undefined,
      })

      // Always create brain task; enable only if user said yes
      const brain = createBrainTask(project.id)
      const brainEnabled = brainAnswer === 'y' || brainAnswer === 'yes'
      if (brainEnabled) updateTask(brain.id, { enabled: true })

      console.log(`\n✅ 项目已创建: ${project.id}`)
      if (project.goal) console.log(`   目标: ${project.goal}`)
      if (project.workDir) console.log(`   工作区: ${project.workDir}`)
      if (brainEnabled) {
        console.log(`🧠 AI 大脑已启用 (Cron 在 daemon 运行时生效)`)
      } else {
        console.log(`🧠 AI 大脑已内置（当前关闭，可用 conductor task update ${brain.id} --enable 开启）`)
      }

      console.log('')
      print(project, false)
    })

  proj
    .command('brain')
    .description('manage AI brain task for a project')
    .addCommand(
      new Command('add')
        .description('add an AI brain task to an existing project')
        .argument('<projectId>', 'project ID')
        .option('--json', 'output as JSON')
        .action((projectId, opts) => {
          ensureDb()
          const project = getProject(projectId)
          if (!project) error(`project ${projectId} not found`)
          const brain = createBrainTask(projectId)
          if (!opts.json) console.log(`🧠 AI 大脑已启用 (Cron 在 daemon 运行时生效)`)
          print(brain, opts.json)
        })
    )
}
