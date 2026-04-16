#!/usr/bin/env bun
import { Command } from 'commander'
import { registerProjectCommands } from './src/controllers/cli/projects'
import { registerGroupCommands } from './src/controllers/cli/groups'
import { registerTaskCommands } from './src/controllers/cli/tasks'
import { registerPromptCommands } from './src/controllers/cli/prompts'
import { registerTtsCommands } from './src/controllers/cli/tts'

const program = new Command()
  .name('conductor')
  .description('local-first task scheduler for humans and AI')
  .version('0.1.0')

registerProjectCommands(program)
registerGroupCommands(program)
registerTaskCommands(program)
registerPromptCommands(program)
registerTtsCommands(program)

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
  .command('auth')
  .description('manage HTTP API authentication')
  .addCommand(
    new Command('token')
      .description('generate and save a new access token (enables auth)')
      .action(() => {
        const { enableAuth } = require('./src/services/auth')
        const token = enableAuth()
        console.log('\nAccess token generated and saved to ~/.conductor/auth.json')
        console.log('\nToken:', token)
        console.log('\nUsage:')
        console.log('  Header:  Authorization: Bearer ' + token)
        console.log('  Cookie:  conductor_token=' + token)
        console.log('  Query:   ?token=' + token)
        console.log('\nTo disable auth: conductor auth disable\n')
      }),
  )
  .addCommand(
    new Command('status')
      .description('show whether auth is enabled')
      .action(() => {
        const { isAuthEnabled, getToken } = require('./src/services/auth')
        if (isAuthEnabled()) {
          const token = getToken()
          console.log('Auth: ENABLED')
          console.log('Token:', token)
        } else {
          console.log('Auth: DISABLED (open access)')
        }
      }),
  )
  .addCommand(
    new Command('disable')
      .description('disable auth (delete token, open access)')
      .action(() => {
        const { disableAuth } = require('./src/services/auth')
        disableAuth()
        console.log('Auth disabled. All API requests are now open.')
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
      _doc: 'Conductor CLI — AI agent quick reference. All commands support --json. Full syntax: conductor <cmd> --help | Full docs: docs/integration.md',
      _note: 'CLI task run = SYNCHRONOUS (blocks). HTTP POST /api/tasks/:id/run = ASYNC (poll for status).',
      _quickstart: [
        'conductor daemon start',
        'conductor project list --json',
        'conductor task create --title "..." --project <id> --assignee ai --kind once --executor-kind ai_prompt --prompt "..." --json',
        'conductor task run <id> --json   # blocks until done',
        'conductor task logs <id> --json',
      ],

      // ── Tasks ─────────────────────────────────────────────────────────────
      tasks: {
        list:        'conductor task list --project <id> [--assignee ai|human] [--status pending|running|done|failed|blocked|cancelled] --json',
        get:         'conductor task get <id> --json',
        logs:        'conductor task logs <id> [--limit 20] --json',
        ops:         'conductor task ops <id> [--limit 20] --json   # audit trail',
        run:         'conductor task run <id> --json   # SYNC: blocks until done',
        done:        'conductor task done <id> [--output "<text→{lastOutput}>"] --json   # human tasks only',
        cancel:      'conductor task cancel <id> --json',
        delete:      'conductor task delete <id> --json',
        update:      'conductor task update <id> [--title ""] [--prompt ""] [--cron ""] [--enable|--disable] [--voice-notice|--no-voice-notice] [--speech-text ""] --json',
        'create: ai once':      'conductor task create --title "<t>" --project <id> --assignee ai --kind once --executor-kind ai_prompt --prompt "<p>" [--depends-on <id>] [--review-on-complete] [--voice-notice [--speech-text "<text>"]] --json',
        'create: ai recurring': 'conductor task create --title "<t>" --project <id> --assignee ai --kind recurring --cron "<expr>" --executor-kind ai_prompt --prompt "<p>" --json',
        'create: ai scheduled': 'conductor task create --title "<t>" --project <id> --assignee ai --kind scheduled --scheduled-at "<ISO8601>" --executor-kind ai_prompt --prompt "<p>" --json',
        'create: ai script':    'conductor task create --title "<t>" --project <id> --assignee ai --kind once --executor-kind script --script "<cmd>" [--work-dir "<dir>"] --json',
        'create: ai http':      'conductor task create --title "<t>" --project <id> --assignee ai --kind once --executor-kind http --http-url "<url>" --http-method POST [--http-body "<json>"] --json',
        'create: human (checkpoint)': 'conductor task create --title "<t>" --project <id> --assignee human --kind once --instructions "<tell human what to do; include: conductor task done <id> --output ...>" [--depends-on <id>] --json',
      },

      // ── Projects ──────────────────────────────────────────────────────────
      projects: {
        list:     'conductor project list --json',
        get:      'conductor project get <id> --json',
        create:   'conductor project create --name "<name>" [--goal "<goal>"] [--work-dir "<path>"] [--created-by ai] --json',
        update:   'conductor project update <id> [--name ""] [--goal ""] [--work-dir ""] [--group <gid>|--no-group] [--pin|--no-pin] --json',
        archive:  'conductor project archive <id> --json',
        unarchive:'conductor project unarchive <id> --json',
        delete:   'conductor project delete <id> --json',
        'reorder ungrouped': 'conductor project reorder-ungrouped <id1> <id2> ... --json',
      },

      // ── Groups ────────────────────────────────────────────────────────────
      groups: {
        list:    'conductor group list --json   # includes projects array per group',
        get:     'conductor group get <id> --json',
        create:  'conductor group create --name "<name>" [--collapsed] [--created-by ai] --json',
        update:  'conductor group update <id> [--name ""] [--collapse|--expand] --json',
        delete:  'conductor group delete <id> --json   # projects move to ungrouped',
        reorder: 'conductor group reorder <id1> <id2> ... --json',
        'reorder projects': 'conductor group reorder-projects <gid> <pid1> <pid2> ... --json',
      },

      // ── Prompts ───────────────────────────────────────────────────────────
      prompts: {
        'get system':   'conductor prompt get --json',
        'set system':   'conductor prompt set "<content>"',
        'delete system':'conductor prompt delete',
        'get project':  'conductor prompt get --project <id> --json',
        'set project':  'conductor prompt set "<content>" --project <id>',
      },

      // ── TTS / Voice ───────────────────────────────────────────────────────
      tts: {
        status:  'conductor tts status --json   # → {provider, configured, details}',
        config:  'conductor tts config --provider xfyun --app-id <id> --api-key <key> --api-secret <secret> [--voice x4_xiaoyan] [--speed 50] [--volume 50]',
        'config say': 'conductor tts config --provider say   # macOS fallback, no credentials needed',
        test:    'conductor tts test "<text>"',
        'voice notice on': 'conductor task update <id> --voice-notice [--speech-text "<spoken when done/failed>"] --json',
        'voice notice off':'conductor task update <id> --no-voice-notice --json',
      },

      // ── Daemon / Auth / Info ──────────────────────────────────────────────
      system: {
        'daemon start':  'conductor daemon start',
        'daemon status': 'conductor daemon status',
        'daemon stop':   'conductor daemon stop',
        'auth enable':   'conductor auth token   # generates token, enables auth',
        'auth status':   'conductor auth status',
        'auth disable':  'conductor auth disable',
        info:            'conductor info --json',
      },

      // ── Reference ─────────────────────────────────────────────────────────
      prompt_placeholders: '{date} {datetime} {taskTitle} {taskDescription} {projectName} {lastOutput} {customKey}',
      task_status: 'pending | running | done | failed | blocked | cancelled',
      executor_kinds: 'ai_prompt | script | http',
      voice_notice_tip: 'Set --speech-text to something meaningful, e.g. "分析完成，发现 3 个异常" not just "任务完成"',
    }
    console.log(JSON.stringify(ref, null, 2))
  })

program.parseAsync(process.argv)
