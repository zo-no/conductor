import { Command } from 'commander'
import { readTtsConfig, writeTtsConfig, getTtsStatus, speak } from '../../services/tts'

export function registerTtsCommands(program: Command): void {
  const tts = program.command('tts').description('manage TTS (text-to-speech) voice notifications')

  // conductor tts status
  tts
    .command('status')
    .description('show current TTS configuration')
    .option('--json', 'output as JSON')
    .action(async (opts) => {
      const status = await getTtsStatus()
      if (opts.json) {
        console.log(JSON.stringify(status))
      } else {
        console.log(`Provider : ${status.provider}`)
        console.log(`Configured: ${status.configured}`)
        console.log(`Details  : ${status.details}`)
      }
    })

  // conductor tts config
  tts
    .command('config')
    .description('configure TTS provider')
    .option('--provider <provider>', 'TTS provider: xfyun | say | none')
    .option('--app-id <appId>', 'XFYun App ID')
    .option('--api-key <apiKey>', 'XFYun API Key')
    .option('--api-secret <apiSecret>', 'XFYun API Secret')
    .option('--voice <voice>', 'XFYun voice (default: x4_xiaoyan)')
    .option('--speed <speed>', 'XFYun speech speed 0-100 (default: 50)')
    .option('--volume <volume>', 'XFYun volume 0-100 (default: 50)')
    .option('--json', 'output as JSON')
    .action(async (opts) => {
      const current = await readTtsConfig()

      if (opts.provider) current.provider = opts.provider as any

      if (opts.appId || opts.apiKey || opts.apiSecret || opts.voice || opts.speed || opts.volume) {
        current.xfyun = {
          ...current.xfyun,
          ...(opts.appId ? { appId: opts.appId } : {}),
          ...(opts.apiKey ? { apiKey: opts.apiKey } : {}),
          ...(opts.apiSecret ? { apiSecret: opts.apiSecret } : {}),
          ...(opts.voice ? { voice: opts.voice } : {}),
          ...(opts.speed !== undefined ? { speed: Number(opts.speed) } : {}),
          ...(opts.volume !== undefined ? { volume: Number(opts.volume) } : {}),
        } as any
        if (!current.provider || current.provider === 'none') {
          current.provider = 'xfyun'
        }
      }

      await writeTtsConfig(current)
      const status = await getTtsStatus()

      if (opts.json) {
        console.log(JSON.stringify({ ok: true, ...status }))
      } else {
        console.log('TTS configuration saved.')
        console.log(`Provider : ${status.provider}`)
        console.log(`Details  : ${status.details}`)
      }
    })

  // conductor tts test
  tts
    .command('test [text]')
    .description('test TTS by speaking a message')
    .option('--json', 'output as JSON')
    .action(async (text: string | undefined, opts) => {
      const msg = text ?? '语音通知测试，Conductor 已就绪'
      const status = await getTtsStatus()

      if (!status.configured) {
        const out = { ok: false, error: 'TTS not configured. Run: conductor tts config --provider xfyun ...' }
        if (opts.json) console.log(JSON.stringify(out))
        else console.error(out.error)
        process.exit(1)
      }

      if (opts.json) process.stdout.write(JSON.stringify({ ok: true, provider: status.provider, text: msg }) + '\n')
      else console.log(`Speaking (${status.provider}): ${msg}`)

      try {
        await speak(msg)
        if (!opts.json) console.log('Done.')
      } catch (e: any) {
        const out = { ok: false, error: e?.message ?? String(e) }
        if (opts.json) console.log(JSON.stringify(out))
        else console.error('TTS failed:', out.error)
        process.exit(1)
      }
    })
}
