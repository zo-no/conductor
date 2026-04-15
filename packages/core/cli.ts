#!/usr/bin/env bun
import { Command } from 'commander'
import { initDb } from './src/db/init'
import { registerProjectCommands } from './src/controllers/cli/projects'
import { registerTaskCommands } from './src/controllers/cli/tasks'
import { registerPromptCommands } from './src/controllers/cli/prompts'

const program = new Command()
  .name('conductor')
  .description('local-first task scheduler for humans and AI')
  .version('0.1.0')

initDb()

registerProjectCommands(program)
registerTaskCommands(program)
registerPromptCommands(program)

program
  .command('daemon')
  .description('manage the conductor daemon')
  .addCommand(
    new Command('start').description('start the conductor server').action(async () => {
      const { default: server } = await import('./src/server')
      // server.ts already starts on import
    }),
  )
  .addCommand(
    new Command('status').description('check daemon status').action(async () => {
      try {
        const res = await fetch('http://localhost:7762/health')
        const data = await res.json()
        console.log('running', data)
      } catch {
        console.log('not running')
      }
    }),
  )

program
  .command('info')
  .description('show conductor info')
  .option('--json', 'output as JSON')
  .action(async (opts) => {
    const info = {
      version: '0.1.0',
      db: `${process.env.HOME}/.conductor/db.sqlite`,
      port: 7762,
    }
    if (opts.json) console.log(JSON.stringify(info))
    else console.log(info)
  })

program.parseAsync(process.argv)
