/**
 * TTS 服务 — 讯飞 WebSocket TTS + macOS say 降级
 *
 * 配置文件：~/.conductor/tts-config.json
 * 不依赖外部服务进程，不新增端口，fire-and-forget 调用。
 */

import { createHmac, randomBytes } from 'crypto'
import { writeFile, readFile, writeFile as writeFileFs, rm, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir, homedir, platform } from 'os'
import { spawn } from 'child_process'

// ─── Config ───────────────────────────────────────────────────────────────────

const CONDUCTOR_DIR = join(homedir(), '.conductor')
const TTS_CONFIG_PATH = join(CONDUCTOR_DIR, 'tts-config.json')

export type TtsProvider = 'xfyun' | 'say' | 'none'

export interface XfyunConfig {
  appId: string
  apiKey: string
  apiSecret: string
  voice?: string   // 默认 x4_xiaoyan
  speed?: number   // 0-100，默认 50
  volume?: number  // 0-100，默认 50
}

export interface TtsConfig {
  provider: TtsProvider
  xfyun?: XfyunConfig
}

export async function readTtsConfig(): Promise<TtsConfig> {
  try {
    const raw = await readFile(TTS_CONFIG_PATH, 'utf8')
    return JSON.parse(raw) as TtsConfig
  } catch {
    return { provider: 'none' }
  }
}

export async function writeTtsConfig(config: TtsConfig): Promise<void> {
  await mkdir(CONDUCTOR_DIR, { recursive: true })
  await writeFileFs(TTS_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
}

// ─── Provider detection ───────────────────────────────────────────────────────

function isSayAvailable(): boolean {
  return platform() === 'darwin'
}

export async function resolveProvider(config: TtsConfig): Promise<TtsProvider> {
  if (config.provider === 'xfyun' && config.xfyun?.appId && config.xfyun?.apiKey && config.xfyun?.apiSecret) {
    return 'xfyun'
  }
  if (config.provider === 'say' || (config.provider === 'none' && isSayAvailable())) {
    return isSayAvailable() ? 'say' : 'none'
  }
  // auto fallback: xfyun凭证存在就用，否则 say，否则 none
  if (config.xfyun?.appId && config.xfyun?.apiKey && config.xfyun?.apiSecret) {
    return 'xfyun'
  }
  return isSayAvailable() ? 'say' : 'none'
}

// ─── macOS say ────────────────────────────────────────────────────────────────

function speakWithSay(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('say', [text], { stdio: 'ignore' })
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`say exited with code ${code}`)))
    proc.on('error', reject)
  })
}

// ─── XFYun TTS ────────────────────────────────────────────────────────────────

const XFYUN_HOST = 'tts-api.xfyun.cn'
const XFYUN_PATH = '/v2/tts'
const XFYUN_TIMEOUT_MS = 30_000
const XFYUN_TEXT_BYTES_LIMIT = 8_000
const DEFAULT_VOICE = 'x4_xiaoyan'
const DEFAULT_SPEED = 50
const DEFAULT_VOLUME = 50

function buildXfyunAuthUrl(cfg: XfyunConfig): string {
  const date = new Date().toUTCString()
  const requestLine = `GET ${XFYUN_PATH} HTTP/1.1`
  const signatureOrigin = `host: ${XFYUN_HOST}\ndate: ${date}\n${requestLine}`
  const signature = createHmac('sha256', cfg.apiSecret).update(signatureOrigin).digest('base64')
  const authOrigin = `api_key="${cfg.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authorization = Buffer.from(authOrigin, 'utf8').toString('base64')

  const url = new URL(`wss://${XFYUN_HOST}${XFYUN_PATH}`)
  url.searchParams.set('authorization', authorization)
  url.searchParams.set('host', XFYUN_HOST)
  url.searchParams.set('date', date)
  return url.toString()
}

function buildXfyunPayload(cfg: XfyunConfig, text: string): object {
  const textBytes = Buffer.byteLength(text, 'utf8')
  if (textBytes > XFYUN_TEXT_BYTES_LIMIT) {
    throw new Error(`TTS text too long (${textBytes} bytes, max ${XFYUN_TEXT_BYTES_LIMIT})`)
  }
  return {
    common: { app_id: cfg.appId },
    business: {
      aue: 'lame',
      sfl: 1,
      auf: 'audio/L16;rate=16000',
      vcn: cfg.voice ?? DEFAULT_VOICE,
      speed: cfg.speed ?? DEFAULT_SPEED,
      volume: cfg.volume ?? DEFAULT_VOLUME,
      pitch: 50,
      tte: 'UTF8',
    },
    data: {
      status: 2,
      text: Buffer.from(text, 'utf8').toString('base64'),
    },
  }
}

function synthesizeWithXfyun(cfg: XfyunConfig, text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const authUrl = buildXfyunAuthUrl(cfg)
    const payload = buildXfyunPayload(cfg, text)
    const outPath = join(tmpdir(), `conductor-tts-${Date.now()}-${randomBytes(4).toString('hex')}.mp3`)

    // Bun 全局 WebSocket
    const ws = new WebSocket(authUrl)
    const chunks: Buffer[] = []
    let settled = false
    let endedWithResult = false

    const timeout = setTimeout(() => {
      if (!settled) { settled = true; ws.close(); reject(new Error('XFYun TTS timeout')) }
    }, XFYUN_TIMEOUT_MS)

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      try { ws.close() } catch {}
      rm(outPath, { force: true }).catch(() => {})
      reject(err)
    }

    ws.onopen = () => {
      try { ws.send(JSON.stringify(payload)) } catch (e) { fail(e as Error) }
    }

    ws.onmessage = async (event) => {
      if (settled) return
      let frame: any
      try { frame = JSON.parse(typeof event.data === 'string' ? event.data : Buffer.from(event.data as ArrayBuffer).toString('utf8')) } catch { return }
      const code = Number(frame?.code ?? 0)
      if (code !== 0) { fail(new Error(`XFYun error ${code}: ${frame?.message ?? 'unknown'}`)); return }
      const audio = frame?.data?.audio
      if (typeof audio === 'string' && audio) chunks.push(Buffer.from(audio, 'base64'))
      if (Number(frame?.data?.status) === 2) {
        endedWithResult = true
        settled = true
        clearTimeout(timeout)
        try { ws.close(1000, 'done') } catch {}
        if (chunks.length === 0) { reject(new Error('XFYun returned no audio')); return }
        try {
          await writeFile(outPath, Buffer.concat(chunks))
          resolve(outPath)
        } catch (e) {
          rm(outPath, { force: true }).catch(() => {})
          reject(e)
        }
      }
    }

    ws.onclose = () => {
      if (!settled && !endedWithResult) fail(new Error('XFYun WebSocket closed unexpectedly'))
    }

    ws.onerror = (e) => fail(new Error(`XFYun WebSocket error: ${String(e)}`))
  })
}

async function playMp3(filePath: string): Promise<void> {
  // macOS: afplay；其他平台尝试 ffplay/mpg123
  const players = platform() === 'darwin'
    ? [['afplay', [filePath]]]
    : [['ffplay', ['-nodisp', '-autoexit', filePath]], ['mpg123', ['-q', filePath]]]

  for (const [cmd, args] of players as [string, string[]][]) {
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(cmd, args, { stdio: 'ignore' })
        proc.on('close', code => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)))
        proc.on('error', reject)
      })
      return
    } catch {
      // try next player
    }
  }
  throw new Error('No audio player found (tried afplay/ffplay/mpg123)')
}

async function speakWithXfyun(cfg: XfyunConfig, text: string): Promise<void> {
  const mp3Path = await synthesizeWithXfyun(cfg, text)
  try {
    await playMp3(mp3Path)
  } finally {
    rm(mp3Path, { force: true }).catch(() => {})
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * 播报文本。根据配置自动选择 xfyun 或 say。
 * 失败时静默（不抛出），避免影响主流程。
 */
export async function speak(text: string): Promise<void> {
  const config = await readTtsConfig()
  const provider = await resolveProvider(config)

  if (provider === 'xfyun' && config.xfyun) {
    await speakWithXfyun(config.xfyun, text)
  } else if (provider === 'say') {
    await speakWithSay(text)
  }
  // provider === 'none': 静默
}

/**
 * 检查当前 TTS 状态，返回可读信息。
 */
export async function getTtsStatus(): Promise<{ provider: TtsProvider; configured: boolean; details: string }> {
  const config = await readTtsConfig()
  const provider = await resolveProvider(config)

  if (provider === 'xfyun') {
    return { provider, configured: true, details: `讯飞 TTS，appId: ${config.xfyun!.appId}，声音: ${config.xfyun!.voice ?? DEFAULT_VOICE}` }
  }
  if (provider === 'say') {
    return { provider, configured: true, details: 'macOS say（系统自带）' }
  }
  return { provider: 'none', configured: false, details: '未配置 TTS，语音通知不可用' }
}
