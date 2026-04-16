#!/usr/bin/env bun
import { Command } from 'commander'
import { registerProjectCommands } from './src/controllers/cli/projects'
import { registerGroupCommands } from './src/controllers/cli/groups'
import { registerTaskCommands } from './src/controllers/cli/tasks'
import { registerPromptCommands } from './src/controllers/cli/prompts'

const program = new Command()
  .name('conductor')
  .description('local-first task scheduler for humans and AI')
  .version('0.1.0')

registerProjectCommands(program)
registerGroupCommands(program)
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
  .addCommand(
    new Command('stop').description('stop the conductor daemon').action(async () => {
      try {
        const res = await fetch('http://localhost:7762/health')
        const data = await res.json() as { pid?: number }
        if (!data.pid) { console.log('daemon not running'); return }
        process.kill(data.pid, 'SIGTERM')
        console.log(`stopped (pid ${data.pid})`)
      } catch {
        console.log('daemon not running')
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

program
  .command('help-ai')
  .description('show a concise intent→command reference for AI agents')
  .action(() => {
    const ref = {
      _doc: 'Conductor CLI quick reference for AI agents. Read what you need, look up full syntax with: conductor <command> --help',
      _full_docs: 'docs/integration.md (workflows) | docs/cli-api.md (full reference)',
      _install: 'git clone https://github.com/zo-no/conductor ~/conductor && cd ~/conductor && pnpm install && pnpm install:cli',
      _quickstart: [
        '1. conductor daemon start',
        '2. conductor project list --json   # find your project id',
        '3. conductor task create --title "..." --project <id> --assignee ai --kind once --executor-kind ai_prompt --prompt "..." --json',
        '4. conductor task run <task-id> --json   # synchronous — blocks until done',
        '5. conductor task logs <task-id> --json',
      ],
      _note_sync_vs_async: 'CLI `task run` is SYNCHRONOUS (blocks until done). HTTP POST /api/tasks/:id/run is ASYNC (returns immediately, poll GET /api/tasks/:id for status).',
      intents: {
        'list projects': 'conductor project list --json',
        'create project': 'conductor project create --name "<name>" [--goal "<goal>"] [--work-dir "<path>"] --json',
        'list tasks': 'conductor task list --project <id> [--status <status>] [--assignee ai|human] --json',
        'get task': 'conductor task get <id> --json',
        'create ai task (one-time)': 'conductor task create --title "<title>" --project <id> --assignee ai --kind once --executor-kind ai_prompt --prompt "<prompt>" --json',
        'create ai task (recurring)': 'conductor task create --title "<title>" --project <id> --assignee ai --kind recurring --cron "<expr>" --executor-kind ai_prompt --prompt "<prompt>" --json',
        'create ai task (scheduled once)': 'conductor task create --title "<title>" --project <id> --assignee ai --kind scheduled --scheduled-at "<ISO8601>" --executor-kind ai_prompt --prompt "<prompt>" --json',
        'create human task (wait for human)': 'conductor task create --title "<title>" --project <id> --assignee human --kind once --instructions "<what human should do, include: conductor task done <id> --output ...>" --json',
        'create task that waits for another': 'conductor task create ... --depends-on <prerequisite-task-id> --json',
        'run ai task now': 'conductor task run <id> --json',
        'mark human task done': 'conductor task done <id> [--output "<result that becomes {lastOutput}>"] --json',
        'cancel task': 'conductor task cancel <id> --json',
        'update task prompt or cron': 'conductor task update <id> [--prompt "<new>"] [--cron "<expr>"] [--title "<new>"] --json',
        'disable/enable task': 'conductor task update <id> --disable|--enable --json',
        'delete task': 'conductor task delete <id> --json',
        'view execution history': 'conductor task logs <id> [--limit 20] --json',
        'view audit trail': 'conductor task ops <id> [--limit 20] --json',
        'get/set system prompt': 'conductor prompt get --json | conductor prompt set "<content>"',
        'get/set project prompt': 'conductor prompt get --project <id> --json | conductor prompt set "<content>" --project <id>',
        'check daemon': 'conductor daemon status',
        'list groups with projects': 'conductor group list --json',
        'create group': 'conductor group create --name "<name>" [--collapsed] [--created-by ai] --json',
        'update group': 'conductor group update <id> [--name "<name>"] [--collapse|--expand] --json',
        'delete group (projects move to ungrouped)': 'conductor group delete <id> --json',
        'reorder groups': 'conductor group reorder <id1> <id2> <id3> ... --json',
        'add project to group': 'conductor project update <project-id> --group <group-id> --json',
        'remove project from group': 'conductor project update <project-id> --no-group --json',
        'hide project from sidebar': 'conductor project update <project-id> --no-pin --json',
        'show project in sidebar': 'conductor project update <project-id> --pin --json',
        'reorder projects in group': 'conductor group reorder-projects <group-id> <proj-id1> <proj-id2> ... --json',
        'reorder ungrouped projects': 'conductor project reorder-ungrouped <proj-id1> <proj-id2> ... --json',
      },
      prompt_placeholders: ['{date}', '{datetime}', '{taskTitle}', '{taskDescription}', '{projectName}', '{lastOutput}', '{customKey}'],
      task_status_values: ['pending', 'running', 'done', 'failed', 'blocked', 'cancelled'],
      executor_kinds: ['ai_prompt', 'script', 'http'],
    }
    console.log(JSON.stringify(ref, null, 2))
  })

program.parseAsync(process.argv)
