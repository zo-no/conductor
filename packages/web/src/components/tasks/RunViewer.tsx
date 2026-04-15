import { useEffect, useRef, useState } from 'react'
import type { TaskRun, SpoolLine } from '../../lib/api'
import { api } from '../../lib/api'
import { useSSE } from '../../hooks/useSSE'

interface Props {
  taskId: string
  run: TaskRun
  projectId: string
  onBack: () => void
}

// Parse a claude stream-json line into a renderable block
type Block =
  | { kind: 'text'; content: string }
  | { kind: 'tool_use'; name: string; input: string }
  | { kind: 'tool_result'; toolUseId: string; output: string; isError: boolean }
  | { kind: 'status'; content: string }
  | { kind: 'thinking'; content: string }
  | { kind: 'raw'; content: string }

function parseLine(line: string): Block | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  let obj: any
  try { obj = JSON.parse(trimmed) } catch { return { kind: 'raw', content: trimmed } }

  switch (obj.type) {
    case 'assistant': {
      const content = obj.message?.content
      if (!Array.isArray(content)) return null
      // Return the first meaningful block (we render each line separately)
      for (const block of content) {
        if (block.type === 'text' && block.text) return { kind: 'text', content: block.text }
        if (block.type === 'thinking' && block.thinking) return { kind: 'thinking', content: block.thinking }
        if (block.type === 'tool_use') return {
          kind: 'tool_use',
          name: block.name,
          input: typeof block.input === 'string' ? block.input : JSON.stringify(block.input, null, 2),
        }
      }
      return null
    }
    case 'user': {
      const content = obj.message?.content
      if (!Array.isArray(content)) return null
      for (const block of content) {
        if (block.type === 'tool_result') {
          const output = typeof block.content === 'string'
            ? block.content
            : Array.isArray(block.content)
              ? block.content.map((c: any) => c.text ?? '').join('\n')
              : JSON.stringify(block.content)
          return { kind: 'tool_result', toolUseId: block.tool_use_id ?? '', output, isError: !!block.is_error }
        }
      }
      return null
    }
    case 'system':
      return { kind: 'status', content: `Session: ${obj.session_id ?? obj.subtype ?? 'started'}` }
    case 'result':
      return { kind: 'status', content: obj.is_error ? `Error: ${obj.result ?? 'unknown'}` : `Done` }
    default:
      return null
  }
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'text':
      return (
        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed py-1">
          {block.content}
        </div>
      )
    case 'thinking':
      return (
        <div className="text-xs text-gray-400 italic border-l-2 border-gray-200 pl-2 py-1 my-1">
          💭 {block.content}
        </div>
      )
    case 'tool_use':
      return (
        <div className="my-1.5 rounded-md border border-blue-100 bg-blue-50 overflow-hidden">
          <div className="px-2.5 py-1 bg-blue-100 text-xs font-mono font-medium text-blue-700 flex items-center gap-1.5">
            <span>🔧</span>
            <span>{block.name}</span>
          </div>
          {block.input && (
            <pre className="px-2.5 py-1.5 text-xs text-blue-800 overflow-x-auto max-h-40 font-mono">
              {block.input}
            </pre>
          )}
        </div>
      )
    case 'tool_result':
      return (
        <div className={`my-1.5 rounded-md border overflow-hidden ${block.isError ? 'border-red-100 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
          <div className={`px-2.5 py-1 text-xs font-mono font-medium flex items-center gap-1.5 ${block.isError ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
            <span>{block.isError ? '❌' : '✓'}</span>
            <span>result</span>
          </div>
          {block.output && (
            <pre className={`px-2.5 py-1.5 text-xs overflow-x-auto max-h-40 font-mono ${block.isError ? 'text-red-700' : 'text-gray-700'}`}>
              {block.output}
            </pre>
          )}
        </div>
      )
    case 'status':
      return (
        <div className="text-xs text-gray-400 py-0.5">
          {block.content}
        </div>
      )
    case 'raw':
      return (
        <pre className="text-xs text-gray-300 font-mono py-0.5 overflow-x-auto">
          {block.content}
        </pre>
      )
  }
}

export function RunViewer({ taskId, run, projectId, onBack }: Props) {
  const [lines, setLines] = useState<SpoolLine[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isRunning = run.status === 'running'

  // Load existing spool
  useEffect(() => {
    api.tasks.runSpool(taskId, run.id)
      .then(setLines)
      .finally(() => setLoading(false))
  }, [taskId, run.id])

  // Stream new lines via SSE if run is still running
  const handleSSE = (e: any) => {
    if (e.type === 'run_line' && e.data.runId === run.id) {
      setLines(prev => [...prev, {
        id: Date.now(),
        runId: run.id,
        ts: e.data.ts,
        line: e.data.line,
      }])
    }
  }
  useSSE(isRunning ? projectId : null, handleSSE)

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (isRunning) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length, isRunning])

  const blocks = lines
    .map(l => parseLine(l.line))
    .filter((b): b is Block => b !== null)

  const duration = run.completedAt
    ? `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
    : '运行中...'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${
              run.status === 'done' ? 'text-green-600' :
              run.status === 'failed' ? 'text-red-500' :
              run.status === 'running' ? 'text-blue-600' : 'text-gray-400'
            }`}>
              {run.status === 'running' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mr-1" />}
              {run.status === 'done' ? '✓ 完成' : run.status === 'failed' ? '✗ 失败' : run.status === 'running' ? '执行中' : '已取消'}
            </span>
            <span className="text-xs text-gray-400">{duration}</span>
            <span className="text-xs text-gray-300">{new Date(run.startedAt).toLocaleString('zh-CN')}</span>
          </div>
          {run.error && <p className="text-xs text-red-500 mt-0.5">{run.error}</p>}
        </div>
      </div>

      {/* Spool content */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {loading && <p className="text-xs text-gray-400">加载中...</p>}
        {!loading && blocks.length === 0 && (
          <p className="text-xs text-gray-400">
            {isRunning ? '等待输出...' : '无输出'}
          </p>
        )}
        {blocks.map((block, i) => (
          <BlockView key={i} block={block} />
        ))}
        {isRunning && (
          <div className="flex items-center gap-1 text-xs text-blue-400 mt-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>执行中</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
