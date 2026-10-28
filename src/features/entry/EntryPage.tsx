import { useLiveQuery } from 'dexie-react-hooks'
import { SearchX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { stopAudio } from '../../audio/useSpeech.ts'
import { db } from '../../db/db.ts'
import { getActive, listActive } from '../../db/repo.ts'
import { normalizeLemmaKey } from '../../lib/lemmaKey.ts'
import { BackLink } from '../../ui/BackLink.tsx'
import { buttonClass } from '../../ui/classes.ts'
import { EmptyState } from '../../ui/EmptyState.tsx'
import { PageSkeleton } from '../../ui/Skeleton.tsx'
import { useAddSheet } from '../add/addSheetContext.ts'
import { EntryActions } from './EntryActions.tsx'
import { EntryEditor } from './EntryEditor.tsx'
import { EntryHeader } from './EntryHeader.tsx'
import {
  ContextsSection,
  FamilySection,
  FormsSection,
  NotesSection,
  RelatedSection,
  SensesSection,
  WordListsSection,
} from './EntrySections.tsx'
import { ProgressSection } from './ProgressSection.tsx'
import { findRelated } from './related.ts'

/** Everything the page shows, read together so it updates as one when anything changes. */
async function loadEntryView(id: string) {
  const entry = await getActive('entries', id)
  if (!entry) return null
  const [others, sources, cards, logs] = await Promise.all([
    listActive('entries'),
    listActive('sources'),
    db.cards.where('entryId').equals(id).toArray(),
    db.logs.where('entryId').equals(id).toArray(),
  ])
  return {
    entry,
    others,
    sources,
    cards: cards.filter((card) => card.deletedAt === undefined),
    logs: logs.filter((log) => log.deletedAt === undefined),
  }
}

/** Entry page (spec §6): the word with everything the app knows about it. */
export default function EntryPage() {
  const { id = '' } = useParams()
  const view = useLiveQuery(() => loadEntryView(id), [id])
  const { openAdd } = useAddSheet()
  const [editing, setEditing] = useState(false)

  // Another entry opened from here (family, related) starts at the top and in silence.
  useEffect(() => {
    window.scrollTo({ top: 0 })
    return () => stopAudio()
  }, [id])

  if (view === undefined) return <PageSkeleton />

  if (view === null) {
    return (
      <>
        <BackLink to="/vocabulary" label="Vocabulario" />
        <EmptyState icon={SearchX} title="Esta palabra ya no está">
          Puede que la hayas eliminado desde otro dispositivo.
        </EmptyState>
        <div className="mt-4 flex justify-center">
          <Link to="/vocabulary" className={buttonClass('primary')}>
            Ir al vocabulario
          </Link>
        </div>
      </>
    )
  }

  const { entry, others, sources, cards, logs } = view
  const byKey = new Map(others.filter((other) => other.status !== 'archived').map((other) => [other.lemmaKey, other]))

  return (
    <>
      <BackLink to="/vocabulary" label="Vocabulario" />
      <EntryHeader entry={entry} />
      <ContextsSection entry={entry} sources={sources} />
      <SensesSection entry={entry} />
      <FormsSection entry={entry} />
      <FamilySection
        entry={entry}
        byKey={byKey}
        keyOf={normalizeLemmaKey}
        onAdd={(word) => openAdd({ word })}
      />
      <WordListsSection entry={entry} />
      <NotesSection entry={entry} />
      <RelatedSection related={findRelated(entry, others)} />
      <ProgressSection cards={cards} logs={logs} />
      <EntryActions entry={entry} onEdit={() => setEditing(true)} />
      {editing ? <EntryEditor entry={entry} onClose={() => setEditing(false)} /> : null}
    </>
  )
}
