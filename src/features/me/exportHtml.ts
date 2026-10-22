import { createElement } from 'react'

import i18n, { type Language } from '@/i18n'
import type { AccountExport } from '@/shared/api/types'

import { ExportDocument } from './ExportDocument'

/** hair-chat-export-YYYY-MM-DD.html, the date of the export (UTC, like the backend's JSON name). */
export function htmlExportFilename(data: AccountExport): string {
  return `hair-chat-export-${data.exported_at.slice(0, 10)}.html`
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// Our own constant CSS (no data in it): screen + print, no external resources.
const STYLES = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;padding:24px 16px;font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;background:#fff;overflow-wrap:anywhere}
main{max-width:760px;margin:0 auto}
h1{font-size:1.6rem;margin:0 0 4px}
h2{font-size:1.25rem;margin:32px 0 12px;padding-bottom:4px;border-bottom:2px solid #e5e5e5}
h3{font-size:1.05rem;margin:24px 0 4px}
.muted{color:#666;font-size:.9em}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:0}
dt{color:#666}
dd{margin:0}
table{border-collapse:collapse;width:100%;font-size:.95em}
.table-wrap{overflow-x:auto}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top;overflow-wrap:normal}
.nowrap{white-space:nowrap}
th{background:#f5f5f5}
.conversation{margin-top:24px}
.summary{background:#f7f7f7;border-radius:6px;padding:8px 12px;margin:8px 0}
.message{border-left:4px solid #ccc;padding:8px 12px;margin:12px 0;border-radius:0 6px 6px 0;background:#fafafa}
.message.user{border-color:#2563eb;background:#eff6ff}
.message.assistant{border-color:#16a34a}
.message header{font-weight:600;font-size:.9em;margin-bottom:4px}
.message header time{font-weight:400;color:#666;margin-left:8px}
.content > :first-child{margin-top:0}
.content > :last-child{margin-bottom:0}
.content p,.content ul,.content ol,.content pre,.content table{margin:8px 0}
.content ul,.content ol{padding-left:24px}
.plain{white-space:pre-wrap}
pre{background:#f0f0f0;padding:8px;border-radius:4px;white-space:pre-wrap}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em}
a{color:#1d4ed8}
@media print{
  body{padding:0;font-size:11pt;color:#000}
  main{max-width:none}
  h2,h3,.message header{break-after:avoid}
  .message,tr,dl{break-inside:avoid}
  .message,.summary,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  a{color:inherit}
  a[href^="http"]::after{content:" (" attr(href) ")";font-size:.85em;color:#555}
}
`

/**
 * The JSON export as one self-contained HTML page for reading and printing, in `language`.
 * Everything from the data goes through React (escaped); answers through <Markdown> (no raw HTML,
 * no images, safe URLs). react-dom/server is loaded only when someone asks for this file.
 */
export async function renderExportHtml(data: AccountExport, language: Language): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const t = i18n.getFixedT(language)
  const body = renderToStaticMarkup(createElement(ExportDocument, { data, t, language }))
  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(language)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(`${t('export.title')} — ${data.exported_at.slice(0, 10)}`)}</title>`,
    `<style>${STYLES}</style>`,
    '</head>',
    `<body>${body}</body>`,
    '</html>',
    '',
  ].join('\n')
}
