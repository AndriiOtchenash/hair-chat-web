import { describe, expect, it } from 'vitest'

import { exportFixture } from '@/test/msw/handlers'

import { htmlExportFilename, renderExportHtml } from './exportHtml'

const ATTACK = '<script>alert(1)</script><img src=x onerror="alert(2)"><b>bold?</b>'

function withMessages(user: string, assistant: string) {
  const data = exportFixture()
  const [conversation] = data.conversations
  const [question, answer] = conversation?.messages ?? []
  if (!conversation || !question || !answer) throw new Error('fixture has a dialogue')
  return exportFixture({
    conversations: [
      {
        ...conversation,
        title: '<i>Title</i>',
        summary: '<svg onload="x()">',
        messages: [
          { ...question, content: user },
          { ...answer, content: assistant },
        ],
      },
    ],
  })
}

describe('renderExportHtml', () => {
  it('contains the profile, consents and the conversation as a dialogue', async () => {
    const html = await renderExportHtml(exportFixture(), 'en')

    expect(html).toContain('<title>Hair Chat — your data — 2026-10-22</title>')
    expect(html).toContain('google-oauth2|123')
    expect(html).toContain('I am 18 or older')
    expect(html).toContain('2026-10-v1')
    expect(html).toContain('Conversations (1)')
    const question = html.indexOf('How often should I wash oily hair?')
    const answer = html.indexOf('every 1–2 days')
    expect(question).toBeGreaterThan(-1)
    expect(answer).toBeGreaterThan(question)
    expect(html).toContain('@media print')
  })

  it('escapes HTML from messages, titles and summaries, and drops raw HTML in answers', async () => {
    const html = await renderExportHtml(withMessages(ATTACK, `Answer ${ATTACK} **done**`), 'en')

    // The user's text is shown literally.
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&lt;i&gt;Title&lt;/i&gt;')
    expect(html).toContain('&lt;svg onload=&quot;x()&quot;&gt;')
    // Nothing from the data becomes markup.
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/<img/i)
    expect(html).not.toMatch(/<svg/i)
    expect(html).not.toMatch(/<i>Title/)
    expect(html).not.toContain('<b>bold?</b>')
    expect(html).toContain('<strong>done</strong>')

    // Parsed, the document has no executable or loading elements at all.
    const doc = new DOMParser().parseFromString(html, 'text/html')
    expect(doc.querySelectorAll('script, img, svg, iframe, object, embed, link')).toHaveLength(0)
    expect(doc.querySelectorAll('[onerror], [onload]')).toHaveLength(0)
  })

  it('neutralizes javascript: links in answers', async () => {
    const html = await renderExportHtml(withMessages('q', '[click](javascript:alert(1))'), 'en')
    expect(html).not.toMatch(/javascript:/i)
  })

  it('uses the given language', async () => {
    const html = await renderExportHtml(exportFixture(), 'uk')
    expect(html).toContain('<html lang="uk">')
    expect(html).toContain('Hair Chat — ваші дані')
    expect(html).toContain('Ви')
  })

  it('names the file after the export date', () => {
    expect(htmlExportFilename(exportFixture())).toBe('hair-chat-export-2026-10-22.html')
  })
})
