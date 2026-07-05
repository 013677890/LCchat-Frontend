import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

describe('shared/utils/markdown', () => {
  it('handles empty input gracefully', () => {
    expect(renderMarkdown('')).toBe('')
  })

  it('escapes standard HTML tags to prevent XSS', () => {
    const raw = '<script>alert(1)</script> <iframe src="x"></iframe>'
    const rendered = renderMarkdown(raw)
    expect(rendered).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(rendered).toContain('&lt;iframe src=&quot;x&quot;&gt;&lt;/iframe&gt;')
    expect(rendered).not.toContain('<script>')
  })

  it('formats bold and italic text', () => {
    expect(renderMarkdown('This is **bold** text')).toBe('This is <strong>bold</strong> text')
    expect(renderMarkdown('This is *italic* and _italic_ text')).toBe(
      'This is <em>italic</em> and <em>italic</em> text'
    )
  })

  it('formats safe hyperlinks but ignores malicious script links', () => {
    expect(renderMarkdown('[LCChat](https://github.com)')).toBe(
      '<a href="https://github.com" target="_blank" rel="noopener noreferrer" class="markdown-link">LCChat</a>'
    )
    // malformed/javascript protocol links should not format or should not execute script
    expect(renderMarkdown('[Malicious](javascript:alert(1))')).toBe(
      '[Malicious](javascript:alert(1))'
    )
  })

  it('formats inline code snippets without parsing markdown inside it', () => {
    expect(renderMarkdown('Use `**bold**` inside code')).toBe(
      'Use <code class="code-inline">**bold**</code> inside code'
    )
  })

  it('formats multiline code blocks and preserves linebreaks inside them', () => {
    const text = 'Check out this:\n```js\nconst x = 5;\nconsole.log(x);\n```\nDone!'
    const rendered = renderMarkdown(text)
    expect(rendered).toContain('<pre class="code-block"><code class="language-js">const x = 5;\nconsole.log(x);</code></pre>')
    expect(rendered).toContain('Check out this:<br />')
    expect(rendered).toContain('<br />Done!')
    // Double check it did not inject br inside the code tags
    expect(rendered).not.toContain('const x = 5;<br />')
  })

  it('merges consecutive quote lines into a single blockquote', () => {
    const rendered = renderMarkdown('> first line\n> second line\nafter quote')
    expect(rendered).toContain('<blockquote>first line<br />second line</blockquote>')
    expect(rendered).toContain('after quote')
    // 引用符号本身不应残留在输出里
    expect(rendered).not.toContain('&gt; first line')
  })

  it('keeps a lone greater-than sign outside quote syntax escaped', () => {
    // "a > b" 不是引用语法（> 不在行首），应保持转义文本原样
    expect(renderMarkdown('a > b')).toBe('a &gt; b')
  })
})
