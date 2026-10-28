import { useNow } from '../../lib/useNow.ts'
import { requestSync } from '../../sync/scheduler.ts'
import { SyncDot } from '../../sync/SyncIndicator.tsx'
import { formatAgo } from '../../sync/summary.ts'
import { useSyncOverview } from '../../sync/useSyncSummary.ts'
import { Button } from '../../ui/Button.tsx'
import { SettingRow, SettingsSection } from '../../ui/controls.tsx'

/** Status of the synchronisation and the "Sincronizar ahora" button (spec §10). */
export function SyncSection() {
  const overview = useSyncOverview()
  const now = useNow()
  const { kind, label, hasSecret, pending, lastOkAt, error, warning } = overview

  return (
    <SettingsSection
      title="Sincronización"
      note="Mantiene iguales el iPhone y el PC y guarda una copia en la nube. En el iPhone usa siempre el icono de la pantalla de inicio: su almacenamiento es independiente del de Safari."
    >
      <SettingRow label="Estado">
        <span className="inline-flex items-center gap-2 text-text-2" role="status">
          <SyncDot kind={kind} />
          {label}
        </span>
      </SettingRow>
      {error && kind !== 'syncing' && kind !== 'off' ? (
        <p role="alert" className="px-3 py-2 text-secondary text-again">
          {error.message}
        </p>
      ) : null}
      {warning && !error ? <p className="px-3 py-2 text-secondary text-hard">{warning}</p> : null}
      {hasSecret ? (
        <>
          <SettingRow label="Última sincronización">
            <span className="text-text-2">{lastOkAt === undefined ? 'Todavía no' : formatAgo(lastOkAt, now)}</span>
          </SettingRow>
          <SettingRow label="Pendientes de subir">
            <span className="tabular-nums text-text-2">{pending}</span>
          </SettingRow>
        </>
      ) : (
        <p className="px-3 py-2 text-secondary text-text-2">Introduce el secreto de la app para empezar a sincronizar.</p>
      )}
      <SettingRow label="Sincronizar ahora">
        <Button disabled={!hasSecret || kind === 'syncing'} onClick={() => void requestSync()}>
          {kind === 'syncing' ? 'Sincronizando…' : 'Sincronizar'}
        </Button>
      </SettingRow>
    </SettingsSection>
  )
}
