import { Command } from 'commander'
import {
  listProjects, getProject, createProject, updateProject,
  deleteProject, archiveProject, unarchiveProject,
} from '../../models/projects'
import { reorderProjectsInGroup } from '../../models/project-groups'
import { print, error } from './output'
import { initDb } from '../../db/init'

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
    .command('reorder-ungrouped <ids...>')
    .description('reorder ungrouped projects by providing all ungrouped project ids in new order')
    .option('--json', 'output as JSON')
    .action((ids, opts) => {
      ensureDb()
      reorderProjectsInGroup(null, ids)
      print({ ok: true, order: ids }, opts.json)
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
}
