import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/db.ts'
import { softDeleteRecord } from '../../src/db/repo.ts'
import { findReusableStory } from '../../src/games/story.ts'
import { loadStories, markStoryPlayed, saveStory } from '../../src/games/storyStore.ts'
import { StorySchema } from '../../src/shared/index.ts'
import { entryOf, NOW } from './helpers.ts'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const entries = Array.from({ length: 6 }, (_, i) => entryOf(`word${i}`, 'noun', { cefr: 'B2' }))
const ids = new Set(entries.map((entry) => entry.id))
const output = {
  title: 'A Pint',
  textEn: 'Word0 and word1 met word2.',
  textEs: 'Un cuento.',
  targets: [{ lemma: 'word0', surfaceForm: 'Word0', start: 0, end: 5 }],
}

describe('the stories that are kept', () => {
  it('saves a story with the words it was written for and the level, and queues it to sync', async () => {
    const saved = await saveStory(output, entries, NOW)

    expect(StorySchema.safeParse(saved).success).toBe(true)
    expect(saved).toMatchObject({ title: 'A Pint', level: 'B2', createdAt: NOW, updatedAt: NOW, entryIds: entries.map((entry) => entry.id) })
    expect(saved.playedAt).toBeUndefined()
    expect(await db.stories.get(saved.id)).toEqual(saved)
    expect(await db.outbox.get(['stories', saved.id])).toBeDefined()
  })

  it('lists them newest first and leaves out the deleted ones', async () => {
    const old = await saveStory(output, entries, NOW - 5_000)
    const recent = await saveStory(output, entries, NOW)
    const gone = await saveStory(output, entries, NOW - 1_000)
    await softDeleteRecord('stories', gone.id)

    expect((await loadStories()).map((story) => story.id)).toEqual([recent.id, old.id])
  })

  it('is used again until it is played, and then a new one is asked for', async () => {
    const saved = await saveStory(output, entries, NOW)
    expect(findReusableStory(await loadStories(), ids, ids)?.id).toBe(saved.id)

    await markStoryPlayed(saved.id, NOW + 1_000)

    const [played] = await loadStories()
    expect(played).toMatchObject({ id: saved.id, playedAt: NOW + 1_000 })
    expect(findReusableStory(await loadStories(), ids, ids)).toBeUndefined()
    expect(await db.outbox.get(['stories', saved.id])).toBeDefined()
  })

  it('does not fail when the story is gone', async () => {
    await expect(markStoryPlayed('nope')).resolves.toBeUndefined()
  })
})
