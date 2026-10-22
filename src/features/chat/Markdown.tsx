import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// GFM: tables, ~~strikethrough~~, autolinks (www.…, https://…), task lists, footnotes.
const remarkPlugins = [remarkGfm]

const components: Components = {
  // External links open in a new tab without access to this page (window.opener) or referrer;
  // in-page links (GFM footnotes, #…) stay in the tab.
  a: ({ href, title, children }) => (
    <a
      href={href}
      title={title}
      {...(href?.startsWith('#') ? {} : { target: '_blank', rel: 'noopener noreferrer nofollow' })}
      className="font-medium underline underline-offset-4"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-md bg-muted p-3 text-sm">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-max min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children, style }) => (
    <th style={style} className="border bg-muted px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="border px-2 py-1 align-top">
      {children}
    </td>
  ),
}

/**
 * Assistant answers as markdown (GFM). Raw HTML is never rendered (no rehype-raw, skipHtml), unsafe
 * URLs (javascript:, data:) are dropped by react-markdown's default urlTransform, and images are
 * not loaded (no third-party requests from model output).
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="min-w-0 space-y-3 break-words [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        skipHtml
        disallowedElements={['img']}
        unwrapDisallowed
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
