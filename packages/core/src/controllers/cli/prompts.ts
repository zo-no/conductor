import { Command } from 'commander'
import {
  getSystemPrompt, setSystemPrompt, deleteSystemPrompt,
  getProjectPromptKey,
} from '../../models/system-prompts'
import { print, error } from './output'
import { initDb } from '../../db/init'

function ensureDb(): void { initDb() }

export function registerPromptCommands(program: Command): void {
  const prompt = program.command('prompt').description('manage system prompts')

  prompt
    .command('get')
    .description('get a prompt')
    .option('--project <id>', 'project id (omit for system-level)')
    .option('--json', 'output as JSON')
    .action((opts) => {
      ensureDb()
      const key = opts.project ? getProjectPromptKey(opts.project) : 'default'
      const p = getSystemPrompt(key)
      if (!p) error('prompt not found')
      print(p, opts.json)
    })

  prompt
    .command('set <content>')
    .description('set a prompt')
    .option('--project <id>', 'project id (omit for system-level)')
    .action((content, opts) => {
      ensureDb()
      const key = opts.project ? getProjectPromptKey(opts.project) : 'default'
      const p = setSystemPrompt(key, content)
      console.log(`prompt set (key: ${p.key})`)
    })

  prompt
    .command('delete')
    .description('delete a prompt')
    .option('--project <id>', 'project id (omit for system-level)')
    .option('--json', 'output as JSON')
    .action((opts) => {
      ensureDb()
      const key = opts.project ? getProjectPromptKey(opts.project) : 'default'
      const ok = deleteSystemPrompt(key)
      if (!ok) error('prompt not found')
      print({ ok: true }, opts.json)
    })
}
