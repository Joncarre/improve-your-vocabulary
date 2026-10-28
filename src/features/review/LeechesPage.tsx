import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, Gamepad2, PartyPopper, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { AiError } from '../../ai/client.ts'
import { db } from '../../db/db.ts'
import { listActive } from '../../db/repo.ts'
import { loadDeviceSettings } from '../../db/settings.ts'
import { BackLink } from '../../ui/BackLink.tsx'
import { Button } from '../../ui/Button.tsx'
import { buttonClass } from '../../ui/classes.ts'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { showToast } from '../../ui/toastStore.ts'
import { regenerateExamples, setArchived } from '../entry/actions.ts'

async function loadLeeches() {
  const [entries, cards] = await Promise.all([listActive('entries'), db.cards.toArray()])
  return entries
    .filter((entry) => entry.isLeech && entry.status !== 'archived')
    .map((entry) => ({
      entry,
      lapses: Math.max(0, ...cards.filter((card) => card.entryId === entry.id && card.deletedAt === undefined).map((card) => card.fsrs.lapses)),
    }))
    .sort((a, b) => b.lapses - a.lapses)
}

/**
 * "Rebeldes" (spec §7): words that keep slipping away (six lapses). They are not suspended; here you
 * can ask the AI for fresh examples, archive them or play the games with them.
 */
export default function LeechesPage() {
  const leeches = useLiveQuery(loadLeeches, [])
  const [working, setWorking] = useState<string | null>(null)

  const regenerate = async (entryId: string, lemma: string) => {
    setWorking(entryId)
    try {
      const { appSecret } = await loadDeviceSettings()
      await regenerateExamples(entryId, { secret: appSecret })
      showToast(`Ejemplos nuevos para «${lemma}»`)
    } catch (error) {
      showToast(error instanceof AiError ? error.message : 'No se han podido regenerar los ejemplos.')
    } finally {
      setWorking(null)
    }
  }

  const archive = async (entryId: string, lemma: string) => {
    await setArchived(entryId, true)
    showToast(`«${lemma}» archivada`)
  }

  return (
    <>
      <BackLink to="/" label="Hoy" />
      <h1 className="mt-2 text-title font-semibold tracking-tight">Rebeldes</h1>
      <p className="mt-1 text-secondary text-text-2">Palabras que has fallado muchas veces en el repaso. Siguen en tu calendario; aquí puedes darles otra oportunidad.</p>

      {leeches && leeches.length > 0 ? (
        <Link to="/games?scope=leeches" className={buttonClass('primary', 'mt-4 h-12 w-full')}>
          <Gamepad2 size={18} aria-hidden="true" />
          Jugar con ellas
        </Link>
      ) : null}

      <div className="mt-4">
        {leeches === undefined ? null : leeches.length === 0 ? (
          <EmptyState icon={PartyPopper} title="No tienes palabras rebeldes">
            Una palabra pasa a esta lista cuando la fallas seis veces estando ya en repaso.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {leeches.map(({ entry, lapses }) => (
              <li key={entry.id} className="rounded-card border border-border bg-surface p-3">
                <Link to={`/entry/${entry.id}`} className="block">
                  <span className="flex items-baseline gap-2">
                    <span className="font-serif text-section font-medium">{entry.lemma}</span>
                    {entry.ipa ? <span className="ipa text-caption text-text-3">{entry.ipa}</span> : null}
                  </span>
                  <span className="block text-secondary text-text-2">{entry.senses[0]?.meaningEs}</span>
                  <span className="mt-0.5 block text-caption text-again">{lapses} {lapses === 1 ? 'recaída' : 'recaídas'}</span>
                </Link>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button disabled={working === entry.id || entry.senses.length === 0} onClick={() => void regenerate(entry.id, entry.lemma)}>
                    <Sparkles size={16} aria-hidden="true" />
                    {working === entry.id ? 'Generando…' : 'Nuevos ejemplos'}
                  </Button>
                  <Button onClick={() => void archive(entry.id, entry.lemma)}>
                    <Archive size={16} aria-hidden="true" />
                    Archivar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
