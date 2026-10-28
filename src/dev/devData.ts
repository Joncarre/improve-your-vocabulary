import { db } from '../db/db.ts'
import { generateSeedData, SEED_PREFIX } from './seed.ts'

/**
 * Puts the test collection straight into IndexedDB. It skips the outbox on purpose: this data is
 * for looking at the app in development and must never travel to the other device.
 */
export async function seedDevData(count = 1000): Promise<number> {
  const { entries, cards, topics, sources } = generateSeedData(count)
  await db.transaction('rw', [db.entries, db.cards, db.topics, db.sources], async () => {
    await db.topics.bulkPut(topics)
    await db.sources.bulkPut(sources)
    await db.entries.bulkPut(entries)
    await db.cards.bulkPut(cards)
  })
  return entries.length
}

/** Removes only what `seedDevData` created. */
export async function clearDevData(): Promise<void> {
  await db.transaction('rw', [db.entries, db.cards, db.topics, db.sources], async () => {
    await db.entries.where('id').startsWith(SEED_PREFIX).delete()
    await db.cards.where('id').startsWith(SEED_PREFIX).delete()
    await db.topics.where('id').startsWith(SEED_PREFIX).delete()
    await db.sources.where('id').startsWith(SEED_PREFIX).delete()
  })
}
