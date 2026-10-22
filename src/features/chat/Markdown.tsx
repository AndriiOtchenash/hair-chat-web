import ReactMarkdown, { type Components } from 'react-markdown'

const components: Components = {
  // External links open in a new tab without access to this page (window.opener) or referrer.
  a: ({ href, title, children }) => (
    <a
      href={href}
      title={title}
      target="_blank"
      rel="noopener noreferrer nofollow"
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
      <table>{children}</table>
    </div>
  ),
}

/**
 * Assistant answers as markdown. Raw HTML is never rendered (no rehype-raw, skipHtml), unsafe
 * URLs (javascript:, data:) are dropped by react-markdown's default urlTransform, and images are
 * not loaded (no third-party requests from model output).
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="min-w-0 space-y-3 break-words [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc">
      <ReactMarkdown skipHtml disallowedElements={['img']} unwrapDisallowed components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
