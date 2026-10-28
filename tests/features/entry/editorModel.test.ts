import { describe, expect, it } from 'vitest'
import { draftToEntry, emptyEditorSense, emptyVerbForms, entryToDraft, splitList } from '../../../src/features/entry/editorModel.ts'
import { EntrySchema } from '../../../src/shared/index.ts'
import { makeEntry } from '../../factories.ts'

describe('splitList', () => {
  it('trims, drops empty items and repeated ones', () => {
    expect(splitList(' travel, move ,, travel ,')).toEqual(['travel', 'move'])
    expect(splitList('')).toEqual([])
  })
})

describe('entryToDraft / draftToEntry', () => {
  const full = makeEntry({
    cefr: 'B1',
    learnerNote: 'Cuidado con el falso amigo.',
    usNote: 'En EE. UU. se dice «gotten».',
    synonyms: ['travel', 'move'],
    forms: {
      verb: {
        base: 'learn',
        thirdPerson: 'learns',
        pastSimple: ['learnt', 'learned'],
        pastParticiple: ['learnt', 'learned'],
        presentParticiple: 'learning',
        irregular: false,
      },
      noun: { plural: 'goes', countability: 'both' },
      adjective: { comparative: 'better' },
    },
    family: [{ word: 'outgoing', pos: 'adjective', meaningEs: 'sociable', example: 'She is outgoing.' }],
    contexts: [{ id: 'c1', sentence: 'We went to the pub.', translationEs: 'Fuimos al pub.', addedAt: 1 }],
    topicIds: ['t1', 't2'],
  })

  it('gives back the same entry when nothing was edited', () => {
    const result = draftToEntry(full, entryToDraft(full))
    expect(result).toEqual(full)
    expect(EntrySchema.safeParse(result).success).toBe(true)
  })

  it('does not share nested objects with the original, so editing a draft never touches it', () => {
    const draft = entryToDraft(full)
    expect(draft.senses[0]).not.toBe(full.senses[0])
    expect(draft.senses[0]?.examples[0]).not.toBe(full.senses[0]?.examples[0])
    expect(draft.family[0]).not.toBe(full.family[0])
  })

  it('turns the comma separated fields back into lists', () => {
    const draft = entryToDraft(full)
    const result = draftToEntry(full, {
      ...draft,
      synonyms: 'travel, journey',
      collocations: 'go home, go abroad',
      verb: draft.verb && { ...draft.verb, pastSimple: 'went, wended' },
    })
    expect(result.synonyms).toEqual(['travel', 'journey'])
    expect(result.collocations).toEqual(['go home', 'go abroad'])
    expect(result.forms?.verb?.pastSimple).toEqual(['went', 'wended'])
  })

  it('removes what was emptied instead of saving empty strings', () => {
    const draft = entryToDraft(full)
    const result = draftToEntry(full, {
      ...draft,
      learnerNote: '  ',
      usNote: '',
      cefr: '',
      verb: null,
      noun: null,
      adjective: { comparative: '', superlative: '' },
      family: [{ word: ' ', pos: 'noun', meaningEs: '', example: '' }],
      contexts: [{ id: 'c1', sentence: '   ', addedAt: 1 }],
      senses: [...draft.senses, emptyEditorSense()],
    })
    expect(result).not.toHaveProperty('learnerNote')
    expect(result).not.toHaveProperty('usNote')
    expect(result).not.toHaveProperty('cefr')
    expect(result).not.toHaveProperty('forms')
    expect(result.family).toEqual([])
    expect(result.contexts).toEqual([])
    expect(result.senses).toHaveLength(1)
  })

  it('drops blank examples and keeps the exact word of the others', () => {
    const draft = entryToDraft(full)
    const [sense] = draft.senses
    if (!sense) throw new Error('fixture without senses')
    const result = draftToEntry(full, {
      ...draft,
      senses: [{ ...sense, examples: [{ en: ' ', es: 'x' }, { en: ' We went. ', es: ' Fuimos. ', target: ' went ' }, { en: 'Go on.', es: 'Sigue.', target: ' ' }] }],
    })
    expect(result.senses[0]?.examples).toEqual([
      { en: 'We went.', es: 'Fuimos.', target: 'went' },
      { en: 'Go on.', es: 'Sigue.' },
    ])
  })

  it('keeps at most two topics', () => {
    const result = draftToEntry(full, { ...entryToDraft(full), topicIds: ['a', 'b', 'c'] })
    expect(result.topicIds).toEqual(['a', 'b'])
  })

  it('builds verb forms from a new, filled-in block', () => {
    const draft = entryToDraft(makeEntry())
    const result = draftToEntry(makeEntry(), {
      ...draft,
      verb: { ...emptyVerbForms(), base: 'go', pastSimple: 'went', pastParticiple: 'gone', irregular: true },
    })
    expect(result.forms?.verb).toMatchObject({ base: 'go', pastSimple: ['went'], pastParticiple: ['gone'], irregular: true })
  })

  it('ignores an empty verb block', () => {
    const result = draftToEntry(makeEntry(), { ...entryToDraft(makeEntry()), verb: emptyVerbForms() })
    expect(result).not.toHaveProperty('forms')
  })
})
