import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AiError, requestEnrich } from '../../ai/client.ts'
import { useDeviceSettings } from '../../db/settings.ts'
import { listActive } from '../../db/repo.ts'
import { lookupDictionary } from '../../lib/dictionary.ts'
import { normalizeLemmaKey } from '../../lib/lemmaKey.ts'
import type { Entry } from '../../shared/index.ts'
import { Button } from '../../ui/Button.tsx'
import { buttonClass } from '../../ui/classes.ts'
import { ModalSheet } from '../../ui/ModalSheet.tsx'
import { Skeleton } from '../../ui/Skeleton.tsx'
import { showToast } from '../../ui/toastStore.ts'
import { AddBatch } from './AddBatch.tsx'
import { AddDuplicate } from './AddDuplicate.tsx'
import { AddForm, type FormValues } from './AddForm.tsx'
import { AddPreview } from './AddPreview.tsx'
import type { AddSheetInitial } from './addSheetContext.ts'
import { buildDraftFromAi, buildDraftFromDictionary, canSaveDraft, type EntryDraft } from './draft.ts'
import {
  addContextToExisting,
  findActiveEntryByKey,
  findNewSense,
  getMarathonDefaults,
  listSources,
  loadTopicsForPrompt,
  saveNewEntry,
  type MarathonDefaults,
} from './save.ts'

type View =
  | { name: 'form' }
  | { name: 'batch' }
  | { name: 'analyzing'; word: string }
  | { name: 'preview'; draft: EntryDraft; status: 'active' | 'pending_ai' }
  | { name: 'duplicate'; entry: Entry; draft: EntryDraft | undefined }
  | { name: 'error'; error: AiError }

const TITLES: Record<View['name'], string> = {
  form: 'Añadir palabra',
  batch: 'Añadir varias',
  analyzing: 'Analizando…',
  preview: 'Revisa la ficha',
  duplicate: 'Ya la tienes',
  error: 'No se ha podido analizar',
}

function toAiError(error: unknown): AiError {
  return error instanceof AiError ? error : new AiError('upstream', 'Ha ocurrido un error inesperado.')
}

interface AddSheetProps {
  initial: AddSheetInitial
  onClose: () => void
}

export function AddSheet({ initial, onClose }: AddSheetProps) {
  const { settings: device } = useDeviceSettings()
  const topics = useLiveQuery(() => listActive('topics'), [], [])
  const sources = useLiveQuery(() => listSources(), [], [])
  const [values, setValues] = useState<FormValues>({
    word: initial.word ?? '',
    sentence: initial.sentence ?? '',
    source: '',
    detail: '',
  })
  const [marathon, setMarathon] = useState<MarathonDefaults | undefined>()
  const [view, setView] = useState<View>({ name: 'form' })
  // Each analysis gets a number; an answer that arrives after the user went back is ignored.
  const latest = useRef(0)

  useEffect(() => {
    let cancelled = false
    void getMarathonDefaults().then((defaults) => {
      if (cancelled || !defaults) return
      setMarathon(defaults)
      setValues((current) => (current.source ? current : { ...current, source: defaults.sourceTitle, detail: defaults.detail }))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const goBack = () => {
    latest.current += 1
    setView({ name: 'form' })
  }

  async function analyze(unit?: string) {
    const word = (unit ?? values.word).trim()
    if (!word) return
    const sentence = values.sentence.trim()
    latest.current += 1
    const run = latest.current
    setView({ name: 'analyzing', word })

    const typedMatch = await findActiveEntryByKey(normalizeLemmaKey(word))
    if (run !== latest.current) return
    // Already there and nothing to add but the word itself: no need to ask the AI.
    if (typedMatch && !sentence) {
      setView({ name: 'duplicate', entry: typedMatch, draft: undefined })
      return
    }

    try {
      const output = await requestEnrich(
        {
          input: word,
          ...(sentence ? { context: sentence } : {}),
          ...(values.source.trim() ? { sourceTitle: values.source.trim() } : {}),
          existingTopics: await loadTopicsForPrompt(),
        },
        { secret: device.appSecret },
      )
      if (run !== latest.current) return
      // `values.word` (not the unit) is what was typed, so the original form is kept as seenForm.
      const draft = buildDraftFromAi(output, values.word)
      const lemmaMatch = await findActiveEntryByKey(normalizeLemmaKey(draft.lemma))
      if (run !== latest.current) return
      setView(lemmaMatch ? { name: 'duplicate', entry: lemmaMatch, draft } : { name: 'preview', draft, status: 'active' })
    } catch (error) {
      if (run !== latest.current) return
      // The AI failed but the word is already saved: the sentence can still be added to it.
      setView(typedMatch ? { name: 'duplicate', entry: typedMatch, draft: undefined } : { name: 'error', error: toAiError(error) })
    }
  }

  async function fillFromDictionary(error: AiError) {
    latest.current += 1
    const run = latest.current
    setView({ name: 'analyzing', word: values.word.trim() })
    const result = await lookupDictionary(values.word)
    if (run !== latest.current) return
    setView({
      name: 'preview',
      draft: buildDraftFromDictionary(values.word, result),
      // A temporary failure will be fixed by the AI later; otherwise the entry is final.
      status: error.retryable ? 'pending_ai' : 'active',
    })
  }

  async function save(draft: EntryDraft, status: 'active' | 'pending_ai') {
    try {
      await saveNewEntry({
        draft,
        status,
        sentence: values.sentence,
        sourceTitle: values.source,
        detail: values.detail,
      })
      showToast(status === 'pending_ai' ? `«${draft.lemma}» guardada: se completará sola` : `«${draft.lemma}» guardada`)
      onClose()
    } catch {
      showToast('No se ha podido guardar. Inténtalo de nuevo.')
    }
  }

  async function addToExisting(entry: Entry, draft: EntryDraft | undefined, includeSense: boolean) {
    try {
      const result = await addContextToExisting(entry.id, {
        sentence: values.sentence,
        translationEs: draft?.contextTranslationEs,
        surface: draft?.contextSurface,
        sourceTitle: values.source,
        detail: values.detail,
        newSense: includeSense && draft ? findNewSense(entry, draft) : undefined,
      })
      showToast(
        result.contextAdded || result.senseAdded ? `Añadido a «${entry.lemma}»` : `«${entry.lemma}» ya lo tenía todo`,
      )
      onClose()
    } catch {
      showToast('No se ha podido guardar. Inténtalo de nuevo.')
    }
  }

  const sentenceKey = normalizeLemmaKey(values.sentence)

  let body
  let footer
  switch (view.name) {
    case 'form':
      body = (
        <AddForm
          values={values}
          onChange={setValues}
          sources={sources}
          marathon={marathon}
          onSubmit={() => void analyze()}
          onBatch={() => setView({ name: 'batch' })}
        />
      )
      break
    case 'batch':
      body = (
        <AddBatch
          secret={device.appSecret}
          sources={sources}
          initialSource={values.source}
          initialDetail={values.detail}
          onBack={goBack}
          onDone={onClose}
        />
      )
      break
    case 'analyzing':
      body = (
        <div role="status" aria-live="polite" className="space-y-3 pt-2">
          <p className="text-secondary text-text-2">
            Preparando la ficha de <strong className="font-semibold text-text">{view.word}</strong>…
          </p>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Button className="w-full" onClick={goBack}>
            Cancelar
          </Button>
        </div>
      )
      break
    case 'preview': {
      const { draft, status } = view
      body = (
        <>
          {draft.origin !== 'ai' ? (
            <p className="mb-2 rounded-card border border-border bg-surface-2 p-3 text-secondary text-text-2">
              {draft.origin === 'dictionary'
                ? 'Sin la IA: he traído lo que sabe el diccionario. Escribe tú el significado en español.'
                : 'Sin la IA: rellena la ficha a mano.'}
              {status === 'pending_ai' ? ' La IA la completará sola cuando vuelva a estar disponible.' : ''}
            </p>
          ) : null}
          <AddPreview
            draft={draft}
            topics={topics}
            hasSentence={Boolean(values.sentence.trim())}
            onChange={(next) => setView({ name: 'preview', draft: next, status })}
            onUseUnit={(unit) => void analyze(unit)}
          />
        </>
      )
      footer = (
        <div className="flex gap-2">
          <Button onClick={goBack}>Volver</Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={!canSaveDraft(draft, status)}
            onClick={() => void save(draft, status)}
          >
            {status === 'pending_ai' ? 'Guardar y completar después' : 'Guardar'}
          </Button>
        </div>
      )
      break
    }
    case 'duplicate': {
      const { entry, draft } = view
      body = (
        <AddDuplicate
          entry={entry}
          sentence={values.sentence.trim()}
          sentenceKnown={entry.contexts.some((context) => normalizeLemmaKey(context.sentence) === sentenceKey)}
          newSense={draft ? findNewSense(entry, draft) : undefined}
          onAdd={(includeSense) => void addToExisting(entry, draft, includeSense)}
          onClose={onClose}
        />
      )
      break
    }
    case 'error': {
      const { error } = view
      body = (
        <div className="space-y-4">
          <p role="alert" className="rounded-card border border-again/40 bg-again/10 p-3 text-secondary">
            {error.message}
          </p>
          {error.code === 'unauthorized' ? (
            <Link to="/settings" onClick={onClose} className={buttonClass('primary', 'w-full')}>
              Ir a Ajustes
            </Link>
          ) : null}
          <div className="flex flex-col gap-2">
            {error.retryable ? (
              <Button variant="primary" onClick={() => void analyze()}>
                Reintentar
              </Button>
            ) : null}
            {error.retryable ? (
              <Button onClick={() => void save(buildDraftFromDictionary(values.word, null), 'pending_ai')}>
                Guardar y completar después
              </Button>
            ) : null}
            {/* Whatever went wrong, the entry can still be filled in with the dictionary and by hand. */}
            <Button
              variant={error.retryable || error.code === 'unauthorized' ? 'secondary' : 'primary'}
              onClick={() => void fillFromDictionary(error)}
            >
              Rellenar con el diccionario
            </Button>
            <Button variant="ghost" onClick={goBack}>
              Volver
            </Button>
          </div>
        </div>
      )
      break
    }
  }

  return (
    <ModalSheet title={TITLES[view.name]} onClose={onClose} footer={footer}>
      {body}
    </ModalSheet>
  )
}
