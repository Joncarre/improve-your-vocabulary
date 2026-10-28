import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../../src/db/db.ts'
import { listActive, writeRecord } from '../../../src/db/repo.ts'
import { editTopic, entriesOfSource, firstGrapheme, mergeTopics, topicUsage } from '../../../src/features/library/topics.ts'
import { makeEntry, makeTopic } from '../../factories.ts'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const addTopic = (id: string, nameEs: string, extra = {}) =>
  writeRecord('topics', makeTopic({ id, nameEs, ...extra }), { enqueue: false })
const addEntry = (id: string, topicIds: string[], extra = {}) =>
  writeRecord('entries', makeEntry({ id, lemma: id, lemmaKey: id, topicIds, ...extra }), { enqueue: false })

describe('topicUsage', () => {
  it('counts the words of each topic and skips deleted ones', () => {
    const usage = topicUsage([
      makeEntry({ topicIds: ['a', 'b'] }),
      makeEntry({ topicIds: ['a'] }),
      makeEntry({ topicIds: ['a'], deletedAt: 5 }),
    ])
    expect(usage.get('a')).toBe(2)
    expect(usage.get('b')).toBe(1)
  })
})

describe('firstGrapheme', () => {
  it('keeps one whole emoji, even with modifiers, and nothing else', () => {
    expect(firstGrapheme('🍺')).toBe('🍺')
    expect(firstGrapheme('  ✈️ abc')).toBe('✈️')
    expect(firstGrapheme('👨‍🍳 chef')).toBe('👨‍🍳')
    expect(firstGrapheme('   ')).toBe('')
  })
})

describe('editTopic', () => {
  it('renames, and changes emoji and colour, queueing the change for sync', async () => {
    await addTopic('t1', 'En el pub')
    const result = await editTopic('t1', { nameEs: '  En el bar ', emoji: '🍻 extra', color: '#9fdcbf' }, 5_000)
    expect(result).toMatchObject({ ok: true, topic: { nameEs: 'En el bar', emoji: '🍻', color: '#9fdcbf', updatedAt: 5_000 } })
    expect(await db.outbox.get(['topics', 't1'])).toBeDefined()
  })

  it('refuses an empty name, a name another topic has (even with other case or accents) and colours outside the palette', async () => {
    await addTopic('t1', 'En el pub')
    await addTopic('t2', 'Discusión')
    expect(await editTopic('t1', { nameEs: '   ' })).toMatchObject({ ok: false, reason: 'empty' })
    expect(await editTopic('t1', { nameEs: 'discusion' })).toMatchObject({ ok: false, reason: 'duplicate' })
    expect(await editTopic('t1', { color: '#123456' })).toMatchObject({ ok: false, reason: 'color' })
    expect(await editTopic('nope', { nameEs: 'x' })).toMatchObject({ ok: false, reason: 'missing' })
    expect((await db.topics.get('t1'))?.nameEs).toBe('En el pub')
  })

  it('lets a topic keep its own name when only the emoji changes', async () => {
    await addTopic('t1', 'En el pub')
    expect(await editTopic('t1', { nameEs: 'En el pub', emoji: '🍺' })).toMatchObject({ ok: true })
  })
})

describe('mergeTopics', () => {
  it('moves the words to the other topic and deletes the merged one (logically)', async () => {
    await addTopic('food', 'Comida')
    await addTopic('eat', 'Food')
    await addEntry('a', ['food'])
    await addEntry('b', ['food', 'other'])
    await addEntry('c', ['eat'])

    expect(await mergeTopics('food', 'eat', 7_000)).toBe(2)

    expect((await db.entries.get('a'))?.topicIds).toEqual(['eat'])
    expect((await db.entries.get('b'))?.topicIds).toEqual(['eat', 'other'])
    expect((await db.entries.get('c'))?.topicIds).toEqual(['eat'])
    expect(await db.topics.get('food')).toMatchObject({ deletedAt: 7_000 })
    expect((await listActive('topics')).map((t) => t.id)).toEqual(['eat'])
    // everything that changed is queued for the other device
    expect(await db.outbox.get(['entries', 'a'])).toBeDefined()
    expect(await db.outbox.get(['topics', 'food'])).toBeDefined()
  })

  it('does not repeat a topic when the word had both, and never leaves more than two', async () => {
    await addTopic('a', 'A')
    await addTopic('b', 'B')
    await addTopic('c', 'C')
    await addEntry('both', ['a', 'b'])
    await addEntry('three', ['a', 'c', 'b'])

    await mergeTopics('a', 'b')

    expect((await db.entries.get('both'))?.topicIds).toEqual(['b'])
    expect((await db.entries.get('three'))?.topicIds).toEqual(['b', 'c'])
  })

  it('leaves deleted words alone and does nothing for a topic that does not exist or onto itself', async () => {
    await addTopic('a', 'A')
    await addTopic('b', 'B')
    await addEntry('gone', ['a'], { deletedAt: 3 })

    expect(await mergeTopics('a', 'a')).toBe(0)
    expect(await mergeTopics('a', 'missing')).toBe(0)
    expect(await mergeTopics('a', 'b')).toBe(0)
    expect((await db.entries.get('gone'))?.topicIds).toEqual(['a'])
  })
})

describe('entriesOfSource', () => {
  it('lists the words seen in a series, newest first, without deleted ones', () => {
    const seen = (sourceId: string) => [{ id: 'c', sentence: 'x', addedAt: 1, sourceId }]
    const list = entriesOfSource(
      [
        makeEntry({ id: 'old', createdAt: 1, contexts: seen('s1') }),
        makeEntry({ id: 'new', createdAt: 9, contexts: seen('s1') }),
        makeEntry({ id: 'other', createdAt: 5, contexts: seen('s2') }),
        makeEntry({ id: 'gone', createdAt: 7, contexts: seen('s1'), deletedAt: 1 }),
        makeEntry({ id: 'none', createdAt: 8 }),
      ],
      's1',
    )
    expect(list.map((e) => e.id)).toEqual(['new', 'old'])
  })
})
