import { db } from '../db/db.ts'
import { listActive } from '../db/repo.ts'
import { loadDeviceSettings, loadSharedSettings } from '../db/settings.ts'
import type { Card, DeviceSettings, Entry, ReviewLog, SharedSettings } from '../shared/index.ts'
import { buildQueue, type QueueResult } from './queue.ts'
import { State } from './scheduler.ts'
import { studyDayEnd, studyDayStart } from './studyDay.ts'

/** Everything the queue needs, read from the database at one moment. */
export interface StudySnapshot {
  entries: Entry[]
  cards: Card[]
  shared: SharedSettings
  device: DeviceSettings
  /** Regular reviews answered today (undone ones excluded). */
  logsToday: ReviewLog[]
}

export async function loadStudySnapshot(now = Date.now()): Promise<StudySnapshot> {
  const [entries, cards, shared, device] = await Promise.all([
    listActive('entries'),
    listActive('cards'),
    loadSharedSettings(),
    loadDeviceSettings(),
  ])
  const start = studyDayStart(now, shared.dayStartHour)
  const end = studyDayEnd(now, shared.dayStartHour)
  const today = await db.logs.where('at').between(start, end, true, false).toArray()
  return { entries, cards, shared, device, logsToday: today.filter((log) => log.deletedAt === undefined && log.origin === 'review') }
}

/** New cards started today: the answers given to a card that was still new. */
function newCardsToday(logs: readonly ReviewLog[]): { count: number; entryIds: Set<string> } {
  const started = logs.filter((log) => (log.fsrsLog as { state?: number } | undefined)?.state === State.New)
  return { count: new Set(started.map((log) => log.cardId)).size, entryIds: new Set(started.map((log) => log.entryId)) }
}

export function queueFromSnapshot(snapshot: StudySnapshot, now = Date.now()): QueueResult {
  const { count, entryIds } = newCardsToday(snapshot.logsToday)
  const answeredToday = new Map<string, Set<string>>()
  for (const log of snapshot.logsToday) {
    const ids = answeredToday.get(log.entryId) ?? new Set<string>()
    ids.add(log.cardId)
    answeredToday.set(log.entryId, ids)
  }
  return buildQueue({
    entries: snapshot.entries,
    cards: snapshot.cards,
    now,
    dayStartHour: snapshot.shared.dayStartHour,
    newPerDay: snapshot.shared.newPerDay,
    productionEnabled: snapshot.shared.productionEnabled,
    desiredRetention: snapshot.shared.desiredRetention,
    backlogMode: snapshot.device.backlogMode ?? false,
    newStartedToday: count,
    newTodayEntryIds: entryIds,
    answeredToday,
  })
}
