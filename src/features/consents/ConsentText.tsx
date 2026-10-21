import Markdown from 'react-markdown'

/** Consent markdown; raw HTML (incl. comments) is never rendered. */
export function ConsentMarkdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown skipHtml>{children}</Markdown>
    </div>
  )
}
