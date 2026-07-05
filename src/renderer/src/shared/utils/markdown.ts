/**
 * A highly robust, lightweight, and XSS-safe Markdown parsing utility
 * designed to render text-based chat messages with developer-friendly styles.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function renderMarkdown(text: string): string {
  if (!text) return ''

  // 1. Escape the entire input first to shield against XSS injections
  const escaped = escapeHtml(text)

  // 2. Extract multi-line code blocks into placeholders (avoiding underscores to prevent italic interference)
  const codeBlocks: string[] = []
  let placeholderIndex = 0

  const codeBlockRegex = /```([a-zA-Z0-9+#-]+)?\r?\n?([\s\S]*?)\r?\n?```/g
  
  let formatted = escaped.replace(codeBlockRegex, (_, lang, code) => {
    const trimmedCode = code.trim()
    const languageClass = lang ? `language-${lang.toLowerCase()}` : 'language-text'
    const blockHtml = `<pre class="code-block"><code class="${languageClass}">${trimmedCode}</code></pre>`
    codeBlocks.push(blockHtml)
    const placeholder = `%%CODEBLOCKPLACEHOLDER${placeholderIndex}%%`
    placeholderIndex++
    return placeholder
  })

  // 3. Extract inline code snippets into placeholders (using % instead of _)
  const inlineCodes: string[] = []
  let inlineIndex = 0
  
  formatted = formatted.replace(/`([^`]+)`/g, (_, code) => {
    const inlineHtml = `<code class="code-inline">${code}</code>`
    inlineCodes.push(inlineHtml)
    const placeholder = `%%INLINECODEPLACEHOLDER${inlineIndex}%%`
    inlineIndex++
    return placeholder
  })

  // 4. Apply markdown formatting to normal text segments
  // Blockquote: lines starting with "> " (escaped to "&gt; " in step 1).
  // Consecutive quote lines are merged into a single blockquote.
  formatted = formatted.replace(
    /(^|\n)((?:&gt; ?[^\n]*(?:\n|$))+)/g,
    (_match, leading, quoteBlock: string) => {
      const inner = quoteBlock
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => line.replace(/^&gt; ?/, ''))
        .join('\n')
      return `${leading}<blockquote>${inner}</blockquote>`
    }
  )

  // Bold: **text**
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // Italic: *text* or _text_
  formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>')

  // Safe Links: [text](url) - accepts http, https, and hash routes
  formatted = formatted.replace(/\[([^\]]+)\]\(((?:https?:\/\/|#)[^\s)]+)\)/g, (match, linkText, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="markdown-link">${linkText}</a>`
  })

  // Standard newlines to break tags
  formatted = formatted.replace(/\r?\n/g, '<br />')

  // 5. Safely re-inject placeholders in order (inline first, then blocks)
  inlineCodes.forEach((html, i) => {
    formatted = formatted.replace(`%%INLINECODEPLACEHOLDER${i}%%`, html)
  })

  codeBlocks.forEach((html, i) => {
    formatted = formatted.replace(`%%CODEBLOCKPLACEHOLDER${i}%%`, html)
  })

  return formatted
}
