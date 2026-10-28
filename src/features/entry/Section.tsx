import type { ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-section font-semibold">{title}</h2>
      {children}
    </section>
  )
}

/** Collapsible translation: native <details>, so it works with VoiceOver and without any script. */
export function Translation({ text }: { text: string }) {
  if (!text) return null
  return (
    <details className="group mt-0.5">
      <summary className="inline-flex min-h-6 cursor-pointer list-none items-center text-caption text-text-3 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Ver traducción</span>
        <span className="hidden group-open:inline">Ocultar traducción</span>
      </summary>
      <p className="mt-0.5 text-secondary text-text-2">{text}</p>
    </details>
  )
}
