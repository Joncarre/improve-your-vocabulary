import { useRef, useState } from 'react'
import { applyRecords, replaceAllRecords } from '../../db/bulk.ts'
import {
  backupFileName,
  backupRecords,
  buildBackup,
  countBackup,
  countLocal,
  parseBackup,
  type BackupCounts,
  type BackupFile,
} from '../../lib/backup.ts'
import { saveFile } from '../../lib/saveFile.ts'
import { requestSync } from '../../sync/scheduler.ts'
import { Button } from '../../ui/Button.tsx'
import { ConfirmSheet } from '../../ui/ConfirmSheet.tsx'
import { ModalSheet } from '../../ui/ModalSheet.tsx'
import { SettingRow, SettingsSection } from '../../ui/controls.tsx'
import { showToast } from '../../ui/toastStore.ts'

const ROWS: { key: keyof BackupCounts; label: string }[] = [
  { key: 'words', label: 'Palabras' },
  { key: 'cards', label: 'Tarjetas' },
  { key: 'reviews', label: 'Repasos' },
  { key: 'sources', label: 'Series y fuentes' },
  { key: 'topics', label: 'Temas' },
  { key: 'games', label: 'Partidas' },
]

const number = new Intl.NumberFormat('es-ES')
const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' })

interface Picked {
  backup: BackupFile
  inFile: BackupCounts
  here: BackupCounts
}

function ImportSheet({ picked, onClose }: { picked: Picked; onClose: () => void }) {
  const [confirmingReplace, setConfirmingReplace] = useState(false)
  const [busy, setBusy] = useState(false)

  const finish = (message: string) => {
    showToast(message)
    onClose()
    // What was imported goes up to the server (and from there to the other devices).
    void requestSync()
  }

  const merge = async () => {
    setBusy(true)
    try {
      const { applied } = await applyRecords(backupRecords(picked.backup), { enqueue: true })
      finish(applied === 0 ? 'No había nada nuevo en la copia' : `Copia fusionada: ${number.format(applied)} registros añadidos o actualizados`)
    } catch {
      setBusy(false)
      showToast('No se ha podido importar la copia')
    }
  }

  const replace = async () => {
    setBusy(true)
    try {
      const { restored, removed } = await replaceAllRecords(backupRecords(picked.backup))
      finish(`Copia restaurada: ${number.format(restored)} registros${removed > 0 ? ` (${number.format(removed)} eliminados)` : ''}`)
    } catch {
      setBusy(false)
      showToast('No se ha podido importar la copia')
    }
  }

  return (
    <>
      <ModalSheet title="Importar copia" onClose={onClose}>
        <p className="pt-2 text-secondary text-text-2">Copia del {dateTime.format(picked.backup.exportedAt)}.</p>
        <table className="mt-3 w-full text-body">
          <thead>
            <tr className="text-caption uppercase tracking-wider text-text-3">
              <th scope="col" className="py-1 text-left font-medium">
                <span className="sr-only">Tipo</span>
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                En el archivo
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Ahora aquí
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ROWS.map(({ key, label }) => (
              <tr key={key}>
                <th scope="row" className="py-1.5 text-left font-normal">
                  {label}
                </th>
                <td className="py-1.5 text-right tabular-nums">{number.format(picked.inFile[key])}</td>
                <td className="py-1.5 text-right tabular-nums text-text-2">{number.format(picked.here[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 space-y-3">
          <div>
            <Button variant="primary" className="w-full" disabled={busy} onClick={() => void merge()}>
              Fusionar
            </Button>
            <p className="mt-1 px-1 text-caption text-text-3">Añade lo que falte y, si un registro está en los dos sitios, se queda el más reciente.</p>
          </div>
          <div>
            <Button variant="danger" className="w-full" disabled={busy} onClick={() => setConfirmingReplace(true)}>
              Reemplazar todo
            </Button>
            <p className="mt-1 px-1 text-caption text-text-3">Deja esto exactamente como el archivo: lo que no esté en él se elimina.</p>
          </div>
          <Button className="w-full" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </ModalSheet>
      {confirmingReplace ? (
        <ConfirmSheet
          title="¿Reemplazar todo?"
          message="Tus palabras y repasos actuales se sustituirán por los de la copia, y lo que no esté en ella se eliminará. Con la sincronización activa, el cambio llegará también a tus otros dispositivos."
          confirmLabel="Reemplazar todo"
          danger
          onConfirm={() => {
            setConfirmingReplace(false)
            void replace()
          }}
          onCancel={() => setConfirmingReplace(false)}
        />
      ) : null}
    </>
  )
}

/** Exporting and importing the backup file (spec §10). */
export function BackupSection() {
  const [busy, setBusy] = useState(false)
  const [waitingFile, setWaitingFile] = useState<File | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [picked, setPicked] = useState<Picked | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const share = async (file: File) => {
    const result = await saveFile(file)
    if (result === 'needs-tap') {
      setWaitingFile(file)
      return
    }
    setWaitingFile(null)
    if (result === 'downloaded') showToast('Copia descargada')
    else if (result === 'shared') showToast('Copia lista')
  }

  const exportNow = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const backup = await buildBackup()
      await share(new File([JSON.stringify(backup)], backupFileName(backup.exportedAt), { type: 'application/json' }))
    } catch {
      setProblem('No se ha podido crear la copia.')
    } finally {
      setBusy(false)
    }
  }

  const choose = async (file: File | undefined) => {
    if (!file) return
    setProblem(null)
    const parsed = parseBackup(await file.text().catch(() => ''))
    if (!parsed.ok) {
      setProblem(parsed.message)
      return
    }
    setPicked({ backup: parsed.backup, inFile: countBackup(parsed.backup), here: await countLocal() })
  }

  return (
    <>
      <SettingsSection
        title="Copia de seguridad"
        note="Un archivo con todo lo tuyo. Guárdalo en Archivos o en iCloud Drive. No incluye el secreto de la app."
      >
        <SettingRow label="Exportar copia" description="Palabras, tarjetas y repasos">
          <Button disabled={busy} onClick={() => void exportNow()}>
            Exportar
          </Button>
        </SettingRow>
        {waitingFile ? (
          <SettingRow label="La copia está lista" description={waitingFile.name}>
            <Button variant="primary" onClick={() => void share(waitingFile)}>
              Guardar
            </Button>
          </SettingRow>
        ) : null}
        <SettingRow label="Importar copia" description="Fusionar o reemplazar">
          <Button onClick={() => input.current?.click()}>Elegir archivo</Button>
        </SettingRow>
        {problem ? (
          <p role="alert" className="px-3 py-2 text-secondary text-again">
            {problem}
          </p>
        ) : null}
        {picked ? <ImportSheet picked={picked} onClose={() => setPicked(null)} /> : null}
      </SettingsSection>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        aria-label="Archivo de copia de seguridad"
        className="hidden"
        onChange={(event) => {
          void choose(event.target.files?.[0])
          // The same file can be chosen again later.
          event.target.value = ''
        }}
      />
    </>
  )
}
