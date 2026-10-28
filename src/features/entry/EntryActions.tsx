import { Archive, ArchiveRestore, Pencil, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AiError } from '../../ai/client.ts'
import { loadDeviceSettings } from '../../db/settings.ts'
import type { Entry } from '../../shared/index.ts'
import { Button } from '../../ui/Button.tsx'
import { ConfirmSheet } from '../../ui/ConfirmSheet.tsx'
import { showToast } from '../../ui/toastStore.ts'
import { deleteEntry, regenerateExamples, resetProgress, setArchived } from './actions.ts'
import { Section } from './Section.tsx'

type Confirming = 'reset' | 'delete' | null

/** Edit, regenerate examples (AI), archive, reset progress and delete (spec §6.10). */
export function EntryActions({ entry, onEdit }: { entry: Entry; onEdit: () => void }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState<Confirming>(null)
  const [regenerating, setRegenerating] = useState(false)
  const archived = entry.status === 'archived'

  const regenerate = async () => {
    setRegenerating(true)
    try {
      const { appSecret } = await loadDeviceSettings()
      await regenerateExamples(entry.id, { secret: appSecret })
      showToast('Ejemplos nuevos guardados')
    } catch (error) {
      showToast(error instanceof AiError ? error.message : 'No se han podido regenerar los ejemplos.')
    } finally {
      setRegenerating(false)
    }
  }

  const toggleArchive = async () => {
    await setArchived(entry.id, !archived)
    showToast(archived ? `«${entry.lemma}» vuelve a tu vocabulario` : `«${entry.lemma}» archivada`)
  }

  const confirm = async () => {
    const action = confirming
    setConfirming(null)
    if (action === 'reset') {
      await resetProgress(entry.id)
      showToast('Progreso reiniciado')
    } else if (action === 'delete') {
      await deleteEntry(entry.id)
      showToast(`«${entry.lemma}» eliminada`)
      navigate('/vocabulary', { replace: true })
    }
  }

  return (
    <Section title="Acciones">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button onClick={onEdit}>
          <Pencil size={16} aria-hidden="true" />
          Editar
        </Button>
        <Button disabled={regenerating || entry.senses.length === 0} onClick={() => void regenerate()}>
          <Sparkles size={16} aria-hidden="true" />
          {regenerating ? 'Regenerando…' : 'Regenerar ejemplos (IA)'}
        </Button>
        <Button onClick={() => void toggleArchive()}>
          {archived ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
          {archived ? 'Desarchivar' : 'Archivar'}
        </Button>
        <Button onClick={() => setConfirming('reset')}>
          <RotateCcw size={16} aria-hidden="true" />
          Reiniciar progreso
        </Button>
        <Button variant="danger" className="sm:col-span-2" onClick={() => setConfirming('delete')}>
          <Trash2 size={16} aria-hidden="true" />
          Eliminar
        </Button>
      </div>

      {confirming === 'reset' ? (
        <ConfirmSheet
          title="Reiniciar progreso"
          message={`«${entry.lemma}» volverá a ser una palabra nueva: se borran sus aciertos, fallos y fechas de repaso.`}
          confirmLabel="Reiniciar"
          onConfirm={() => void confirm()}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
      {confirming === 'delete' ? (
        <ConfirmSheet
          title="Eliminar palabra"
          message={`Se eliminará «${entry.lemma}» con sus frases y tarjetas. Si solo quieres dejar de verla, archívala.`}
          confirmLabel="Eliminar"
          danger
          onConfirm={() => void confirm()}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </Section>
  )
}
