import { Command } from 'commander'
import {
  listGroups, getGroup, createGroup, updateGroup, deleteGroup,
  reorderGroups, reorderProjectsInGroup, getProjectsView,
} from '../../models/project-groups'
import { print, error } from './output'
import { initDb } from '../../db/init'

function ensureDb(): void { initDb() }

export function registerGroupCommands(program: Command): void {
  const group = program.command('group').description('manage project groups')

  group
    .command('list')
    .description('list all groups with their projects')
    .option('--json', 'output as JSON')
    .action((opts) => {
      ensureDb()
      print(getProjectsView(), opts.json)
    })

  group
    .command('get <id>')
    .description('get a group')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const g = getGroup(id)
      if (!g) error(`group ${id} not found`)
      print(g, opts.json)
    })

  group
    .command('create')
    .description('create a project group')
    .requiredOption('--name <name>', 'group name')
    .option('--collapsed', 'default to collapsed in sidebar')
    .option('--created-by <actor>', 'human or ai', 'human')
    .option('--json', 'output as JSON')
    .action((opts) => {
      ensureDb()
      const g = createGroup({
        name: opts.name,
        collapsed: opts.collapsed ?? false,
        createdBy: opts.createdBy as 'human' | 'ai' | 'system',
      })
      print(g, opts.json)
    })

  group
    .command('update <id>')
    .description('update a group')
    .option('--name <name>')
    .option('--collapse', 'set default collapsed')
    .option('--expand', 'set default expanded')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const existing = getGroup(id)
      if (!existing) error(`group ${id} not found`)
      const updates: { name?: string; collapsed?: boolean } = {}
      if (opts.name) updates.name = opts.name
      if (opts.collapse) updates.collapsed = true
      if (opts.expand) updates.collapsed = false
      const updated = updateGroup(id, updates)!
      print(updated, opts.json)
    })

  group
    .command('delete <id>')
    .description('delete a group (projects move to ungrouped)')
    .option('--json', 'output as JSON')
    .action((id, opts) => {
      ensureDb()
      const existing = getGroup(id)
      if (!existing) error(`group ${id} not found`)
      deleteGroup(id)
      print({ ok: true }, opts.json)
    })

  group
    .command('reorder <ids...>')
    .description('reorder groups by providing all group ids in new order')
    .option('--json', 'output as JSON')
    .action((ids, opts) => {
      ensureDb()
      reorderGroups(ids)
      print({ ok: true, order: ids }, opts.json)
    })

  group
    .command('reorder-projects <groupId> <ids...>')
    .description('reorder projects within a group')
    .option('--json', 'output as JSON')
    .action((groupId, ids, opts) => {
      ensureDb()
      const existing = getGroup(groupId)
      if (!existing) error(`group ${groupId} not found`)
      reorderProjectsInGroup(groupId, ids)
      print({ ok: true, groupId, order: ids }, opts.json)
    })
}
