import type { ReactNode } from 'react'
import { splitHighlight } from '../lib/highlight.ts'

/** Shows `text` with the first whole-word occurrence of `target` (any letter case) in the accent colour. */
export function Highlight({ text, target }: { text: string; target?: string | undefined }): ReactNode {
  const parts = splitHighlight(text, target)
  if (!parts) return text
  return (
    <>
      {parts.before}
      <mark className="bg-transparent font-semibold text-accent">{parts.match}</mark>
      {parts.after}
    </>
  )
}
