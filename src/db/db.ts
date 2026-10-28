import Dexie, { type Table } from 'dexie'
import type {
  Card,
  DeviceSettings,
  Entry,
  GameResult,
  OutboxItem,
  ReviewLog,
  SharedSettings,
  Source,
  Story,
  Topic,
} from '../shared/index.ts'

export type VocabDB = Dexie & {
  entries: Table<Entry, string>
  cards: Table<Card, string>
  logs: Table<ReviewLog, string>
  sources: Table<Source, string>
  topics: Table<Topic, string>
  games: Table<GameResult, string>
  stories: Table<Story, string>
  sharedSettings: Table<SharedSettings, string>
  deviceSettings: Table<DeviceSettings, string>
  outbox: Table<OutboxItem, [string, string]>
}

/**
 * Local database (IndexedDB through Dexie). Versioned from day one: never edit a released
 * `version(n).stores(...)`; add `version(n + 1)` with an `.upgrade(...)` when the schema changes.
 *
 * Booleans are not valid IndexedDB keys, so nothing boolean is indexed (the spec's
 * `[suspended+due]` index would silently skip every card). Queries filter those in code.
 */
export function createDatabase(name = 'vocab'): VocabDB {
  // Dexie documents this intersection type as the way to type tables without a subclass.
  const database = new Dexie(name) as VocabDB
  database.version(1).stores({
    entries: 'id, lemmaKey, status, *topicIds, createdAt, updatedAt',
    cards: 'id, entryId, due, type',
    logs: 'id, at, cardId, entryId, origin',
    sources: 'id, title, lastUsedAt',
    topics: 'id, nameEs',
    games: 'id, game, at',
    stories: 'id, createdAt',
    sharedSettings: 'id',
    deviceSettings: 'id',
    outbox: '[table+id], queuedAt',
  })
  return database
}

export const db = createDatabase()
