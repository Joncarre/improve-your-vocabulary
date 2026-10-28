import type { ReactNode } from 'react'

/** Shows `text` with the first occurrence of `target` (any letter case) in the accent colour. */
export function Highlight({ text, target }: { text: string; target?: string | undefined }): ReactNode {
  const needle = target?.trim()
  if (!needle) return text
  const index = text.toLowerCase().indexOf(needle.toLowerCase())
  if (index === -1) return text
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-transparent font-semibold text-accent">{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  )
}
