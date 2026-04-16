/**
 * Lightweight Markdown renderer — no dependencies.
 * Supports: bold, italic, inline code, code blocks, links,
 *           headings (h1-h3), bullet/numbered lists, blockquotes, hr.
 */

interface Props {
  children: string
  className?: string
}

// Escape HTML special chars in plain text segments
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Render inline markdown (bold, italic, code, links) within a line
function renderInline(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    // Inline code: `...`
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      if (end !== -1) {
        out += `<code class="text-xs bg-gray-100 text-gray-800 px-1 py-0.5 rounded font-mono">${escapeHtml(text.slice(i + 1, end))}</code>`
        i = end + 1
        continue
      }
    }
    // Bold: **...** or __...__
    if ((text[i] === '*' && text[i + 1] === '*') || (text[i] === '_' && text[i + 1] === '_')) {
      const marker = text.slice(i, i + 2)
      const end = text.indexOf(marker, i + 2)
      if (end !== -1) {
        out += `<strong class="font-semibold">${renderInline(text.slice(i + 2, end))}</strong>`
        i = end + 2
        continue
      }
    }
    // Italic: *...* or _..._
    if ((text[i] === '*' || text[i] === '_') && text[i + 1] !== text[i]) {
      const marker = text[i]
      const end = text.indexOf(marker, i + 1)
      if (end !== -1 && text[end - 1] !== ' ') {
        out += `<em>${renderInline(text.slice(i + 1, end))}</em>`
        i = end + 1
        continue
      }
    }
    // Link: [text](url)
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1)
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2)
        if (closeParen !== -1) {
          const linkText = text.slice(i + 1, closeBracket)
          const url = text.slice(closeBracket + 2, closeParen)
          out += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:text-blue-800">${renderInline(linkText)}</a>`
          i = closeParen + 1
          continue
        }
      }
    }
    out += escapeHtml(text[i])
    i++
  }
  return out
}

// Parse markdown text into HTML string
function parseMarkdown(md: string): string {
  const lines = md.split('\n')
  let html = ''
  let i = 0
  let inList: 'ul' | 'ol' | null = null

  function closeList() {
    if (inList) {
      html += inList === 'ul' ? '</ul>' : '</ol>'
      inList = null
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block: ```
    if (line.trimStart().startsWith('```')) {
      closeList()
      const lang = line.trimStart().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      const code = codeLines.map(escapeHtml).join('\n')
      html += `<pre class="text-xs bg-gray-100 rounded p-2.5 overflow-x-auto my-1.5 font-mono leading-relaxed"${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}><code>${code}</code></pre>`
      i++
      continue
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line)) {
      closeList()
      html += '<hr class="my-2 border-gray-200" />'
      i++
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      closeList()
      const level = headingMatch[1].length
      const text = renderInline(headingMatch[2])
      const cls = level === 1
        ? 'text-base font-bold mt-2 mb-1'
        : level === 2
          ? 'text-sm font-semibold mt-2 mb-1'
          : 'text-sm font-medium mt-1.5 mb-0.5'
      html += `<h${level} class="${cls}">${text}</h${level}>`
      i++
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      closeList()
      html += `<blockquote class="border-l-2 border-gray-300 pl-3 text-gray-500 italic my-1">${renderInline(line.slice(2))}</blockquote>`
      i++
      continue
    }

    // Unordered list item
    const ulMatch = line.match(/^(\s*)([-*+])\s+(.+)/)
    if (ulMatch) {
      if (inList !== 'ul') {
        closeList()
        html += '<ul class="list-disc list-inside space-y-0.5 my-1 pl-1">'
        inList = 'ul'
      }
      html += `<li class="text-sm">${renderInline(ulMatch[3])}</li>`
      i++
      continue
    }

    // Ordered list item
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/)
    if (olMatch) {
      if (inList !== 'ol') {
        closeList()
        html += '<ol class="list-decimal list-inside space-y-0.5 my-1 pl-1">'
        inList = 'ol'
      }
      html += `<li class="text-sm">${renderInline(olMatch[2])}</li>`
      i++
      continue
    }

    // Empty line
    if (line.trim() === '') {
      closeList()
      html += '<br />'
      i++
      continue
    }

    // Regular paragraph
    closeList()
    html += `<p class="text-sm leading-relaxed">${renderInline(line)}</p>`
    i++
  }

  closeList()
  return html
}

export function Markdown({ children, className = '' }: Props) {
  const html = parseMarkdown(children)
  return (
    <div
      className={`markdown-body ${className}`}
      // Safe: we escape all HTML in user content, only inject known tags
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
