import { CloudOff } from 'lucide-react'
import { Link } from 'react-router'
import type { SyncKind } from './summary.ts'
import { useSyncOverview, useSyncStale } from './useSyncSummary.ts'

const DOT: Record<SyncKind, string> = {
  off: 'bg-text-3',
  syncing: 'bg-accent motion-safe:animate-pulse',
  offline: 'bg-text-3',
  error: 'bg-again',
  pending: 'bg-hard',
  synced: 'bg-good',
}

/** Coloured dot for a sync state. The colour is never the only signal: the text always comes with it. */
export function SyncDot({ kind }: { kind: SyncKind }) {
  return <span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${DOT[kind]}`} />
}

/**
 * Small "Sincronizado · Pendiente · Sin conexión · Error" label (spec §10), a link to Ajustes.
 * It stays out of the way: nothing is shown until the secret has been entered.
 */
export function SyncIndicator() {
  const { kind, label, pending, error } = useSyncOverview()
  if (kind === 'off') return null
  const detail = kind === 'pending' && pending > 0 ? `${label} (${pending})` : label
  return (
    <Link
      to="/settings"
      aria-label={`Sincronización: ${detail}${kind === 'error' && error ? `. ${error.message}` : ''}`}
      className="inline-flex h-9 items-center gap-1.5 rounded-control px-2 text-caption text-text-2 active:bg-surface-2"
    >
      <SyncDot kind={kind} />
      <span aria-hidden="true">{label}</span>
    </Link>
  )
}

/** Shown when the data has not left this device for more than a week. */
export function SyncStaleBanner() {
  const stale = useSyncStale()
  const { hasSecret } = useSyncOverview()
  if (!stale) return null
  return (
    <section
      aria-label="Aviso de copia"
      className="flex items-start gap-3 rounded-card border border-hard/40 bg-hard/10 p-3 text-secondary text-hard"
    >
      <CloudOff size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p>
        Hace más de una semana que tus palabras no se guardan fuera de este dispositivo.{' '}
        <Link to="/settings" className="font-medium underline underline-offset-2">
          {hasSecret ? 'Revisa la sincronización' : 'Activa la sincronización o exporta una copia'}
        </Link>
        .
      </p>
    </section>
  )
}
