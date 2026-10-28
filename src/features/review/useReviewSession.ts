import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { saveDeviceSettings } from '../../db/settings.ts'
import type { Entry } from '../../shared/index.ts'
import { buildCardModel, type CardModel } from '../../srs/cardModel.ts'
import { buildExtraQueue, type QueueItem } from '../../srs/queue.ts'
import { recordExtraReview, reviewCard, undoReview, type ReviewSnapshot } from '../../srs/review.ts'
import { previewGrades, type Grade, type GradePreview } from '../../srs/scheduler.ts'
import { loadStudySnapshot, queueFromSnapshot, type StudySnapshot } from '../../srs/studyData.ts'

/** Cards in a block; after them the session offers to go on or stop (spec §7). */
export const BLOCK_SIZE = 20

export type SessionMode = { kind: 'daily' } | { kind: 'extra'; sourceId: string }

export type SessionPhase = 'loading' | 'card' | 'blockEnd' | 'done'

export interface SessionStats {
  answered: number
  correct: number
  /** New cards answered for the first time. */
  newLearned: number
  /** Time spent answering, in milliseconds. */
  answerMs: number
  /** Words answered "Otra vez" at least once, in the order they failed. */
  weak: Entry[]
}

const EMPTY_STATS: SessionStats = { answered: 0, correct: 0, newLearned: 0, answerMs: 0, weak: [] }

interface Config {
  desiredRetention: number
  dayStartHour: number
  showSentenceOnFront: boolean
}

const DEFAULT_CONFIG: Config = { desiredRetention: 0.9, dayStartHour: 4, showSentenceOnFront: true }

const configOf = (snapshot: StudySnapshot): Config => ({
  desiredRetention: snapshot.shared.desiredRetention,
  dayStartHour: snapshot.shared.dayStartHour,
  showSentenceOnFront: snapshot.shared.showSentenceOnFront,
})

interface UndoStep {
  snapshot: ReviewSnapshot
  statsBefore: SessionStats
  blockBefore: number
  item: QueueItem
}

export interface ReviewSession {
  phase: SessionPhase
  /** The card on screen. */
  item: QueueItem | undefined
  model: CardModel | undefined
  /** Cards in the queue (the block ends after `BLOCK_SIZE` answers). */
  remaining: number
  blockAnswered: number
  stats: SessionStats
  /** Interval shown under each button (daily reviews only). */
  preview: Record<Grade, GradePreview> | undefined
  canUndo: boolean
  busy: boolean
  grade: (grade: Grade) => Promise<void>
  undo: () => Promise<void>
  continueBlock: () => void
}

/**
 * The state of a review session. The queue is built again from the database after every answer, so
 * learning steps, siblings, the daily limit and undo all behave as they do in the real calendar.
 * An extra review ("Repasar esta serie") walks a fixed list instead and never touches the calendar.
 */
export function useReviewSession(mode: SessionMode): ReviewSession {
  const [phase, setPhase] = useState<SessionPhase>('loading')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS)
  const [blockAnswered, setBlockAnswered] = useState(0)
  const [undoStack, setUndoStack] = useState<UndoStep[]>([])
  const [busy, setBusy] = useState(false)
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [previewAt, setPreviewAt] = useState(() => Date.now())
  const shownAt = useRef(0)
  const retried = useRef(new Set<string>())
  const modeKey = mode.kind === 'extra' ? `extra:${mode.sourceId}` : 'daily'

  /** The queue of a daily review, recomputed from the database. */
  const refreshDaily = useCallback(async (): Promise<QueueItem[]> => {
    const snapshot = await loadStudySnapshot()
    setConfig(configOf(snapshot))
    const result = queueFromSnapshot(snapshot)
    if (result.backlogMode !== (snapshot.device.backlogMode ?? false)) void saveDeviceSettings({ backlogMode: result.backlogMode })
    return result.items
  }, [])

  /** Puts the next queue on screen. */
  const show = useCallback((next: QueueItem[], answeredInBlock: number) => {
    setQueue(next)
    setPreviewAt(Date.now())
    shownAt.current = performance.now()
    setPhase(next.length === 0 ? 'done' : answeredInBlock >= BLOCK_SIZE ? 'blockEnd' : 'card')
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let initial: QueueItem[]
      if (mode.kind === 'extra') {
        const snapshot = await loadStudySnapshot()
        const inSource = snapshot.entries.filter((entry) => entry.contexts.some((context) => context.sourceId === mode.sourceId))
        initial = buildExtraQueue(inSource, snapshot.cards)
        if (!cancelled) setConfig(configOf(snapshot))
      } else {
        initial = await refreshDaily()
      }
      if (!cancelled) show(initial, 0)
    })()
    return () => {
      cancelled = true
    }
  }, [modeKey, mode, refreshDaily, show])

  const item = queue[0]
  const model = useMemo(
    () => (item ? buildCardModel(item.card, item.entry, { showSentenceOnFront: config.showSentenceOnFront }) : undefined),
    [item, config.showSentenceOnFront],
  )
  const preview = useMemo(
    () => (item && mode.kind === 'daily' ? previewGrades(item.card.fsrs, previewAt, config.desiredRetention) : undefined),
    [item, mode.kind, previewAt, config.desiredRetention],
  )

  const grade = useCallback(
    async (given: Grade) => {
      if (!item || busy) return
      setBusy(true)
      try {
        const ms = performance.now() - shownAt.current
        const wasNew = item.card.fsrs.state === 0
        const snapshot =
          mode.kind === 'extra'
            ? await recordExtraReview({ cardId: item.card.id, correct: given > 1, ms })
            : await reviewCard({
                cardId: item.card.id,
                grade: given,
                ms,
                scheduleAt: previewAt,
                desiredRetention: config.desiredRetention,
                dayStartHour: config.dayStartHour,
              })
        const nextBlock = blockAnswered + 1
        setUndoStack((stack) => [...stack, { snapshot, statsBefore: stats, blockBefore: blockAnswered, item }])
        setStats({
          answered: stats.answered + 1,
          correct: stats.correct + (given > 1 ? 1 : 0),
          newLearned: stats.newLearned + (wasNew && mode.kind === 'daily' ? 1 : 0),
          answerMs: stats.answerMs + ms,
          weak: given === 1 && !stats.weak.some((entry) => entry.id === item.entry.id) ? [...stats.weak, item.entry] : stats.weak,
        })
        setBlockAnswered(nextBlock)

        if (mode.kind === 'extra') {
          // A card missed in an extra review comes round once more at the end.
          const again = given === 1 && !retried.current.has(item.card.id)
          if (again) retried.current.add(item.card.id)
          show(again ? [...queue.slice(1), item] : queue.slice(1), nextBlock)
        } else {
          show(await refreshDaily(), nextBlock)
        }
      } finally {
        setBusy(false)
      }
    },
    [item, busy, mode.kind, previewAt, config, blockAnswered, stats, queue, show, refreshDaily],
  )

  const undo = useCallback(async () => {
    const step = undoStack.at(-1)
    if (!step || busy) return
    setBusy(true)
    try {
      await undoReview(step.snapshot)
      setUndoStack((stack) => stack.slice(0, -1))
      setStats(step.statsBefore)
      setBlockAnswered(step.blockBefore)
      // The card that was answered comes back first, whatever the order of the queue would be.
      const rest = mode.kind === 'extra' ? queue : await refreshDaily()
      if (mode.kind === 'extra') retried.current.delete(step.item.card.id)
      const undone = rest.find((candidate) => candidate.card.id === step.item.card.id) ?? step.item
      show([undone, ...rest.filter((candidate) => candidate.card.id !== undone.card.id)], step.blockBefore)
    } finally {
      setBusy(false)
    }
  }, [undoStack, busy, mode.kind, queue, show, refreshDaily])

  const continueBlock = useCallback(() => {
    setBlockAnswered(0)
    setPhase(queue.length > 0 ? 'card' : 'done')
    shownAt.current = performance.now()
    setPreviewAt(Date.now())
  }, [queue.length])

  return {
    phase,
    item,
    model,
    remaining: queue.length,
    blockAnswered,
    stats,
    preview,
    canUndo: undoStack.length > 0,
    busy,
    grade,
    undo,
    continueBlock,
  }
}
