import { Command } from 'commander'
import {
  listProjects, getProject, createProject, updateProject,
  deleteProject, archiveProject, unarchiveProject,
} from '../../models/projects'
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
    .option('--json', 'output as JSON')
    .action((opts) => {
      ensureDb()
      const project = createProject({ name: opts.name, goal: opts.goal, workDir: opts.workDir })
      print(project, opts.json)
    })

  proj
    .command('update <id>')
    .description('update a project')
    .option('--name <name>')
    .option('--goal <goal>')
    .option('--work-dir <dir>')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const project = updateProject(id, { name: opts.name, goal: opts.goal, workDir: opts.workDir })
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
}
