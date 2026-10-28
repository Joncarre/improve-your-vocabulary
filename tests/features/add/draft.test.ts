import { describe, expect, it } from 'vitest'
import { buildDraftFromAi, buildDraftFromDictionary, canSaveDraft, emptySense } from '../../../src/features/add/draft.ts'
import { parseDictionaryResponse } from '../../../src/lib/dictionary.ts'
import { makeEnrichOutput } from '../../factories.ts'

describe('buildDraftFromAi', () => {
  it('keeps what was typed as seenForm when it is an inflected form', () => {
    const draft = buildDraftFromAi(makeEnrichOutput(), 'went')

    expect(draft).toMatchObject({ lemma: 'go', seenForm: 'went', origin: 'ai', audioUrl: '' })
    expect(draft.inflectionNote).toContain('pasado simple')
  })

  it('leaves seenForm empty when the lemma itself was typed (ignoring case and punctuation)', () => {
    expect(buildDraftFromAi(makeEnrichOutput(), ' Go. ').seenForm).toBe('')
  })

  it('gives every sense its own id', () => {
    const ids = buildDraftFromAi(makeEnrichOutput(), 'went').senses.map((sense) => sense.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(Boolean)).toBe(true)
  })

  it('turns the "empty" conventions of the model into absent values', () => {
    const draft = buildDraftFromAi(
      makeEnrichOutput({
        cefr: 'unknown',
        forms: { verb: null, noun: { plural: '', countability: 'uncountable' }, adjective: { comparative: '', superlative: '' } },
      }),
      'go',
    )

    expect(draft.cefr).toBeUndefined()
    expect(draft.forms).toEqual({ noun: { countability: 'uncountable' } })
  })

  it('has no forms at all when the model returned none', () => {
    const draft = buildDraftFromAi(makeEnrichOutput({ forms: { verb: null, noun: null, adjective: null } }), 'go')
    expect(draft.forms).toBeUndefined()
  })

  it('carries the proposed unit, topics and context data', () => {
    const draft = buildDraftFromAi(
      makeEnrichOutput({ alternativeUnit: 'go off on one', topicIds: ['t1'], contextSurface: 'went off on one' }),
      'went',
    )
    expect(draft).toMatchObject({ alternativeUnit: 'go off on one', topicIds: ['t1'], contextSurface: 'went off on one' })
  })
})

describe('buildDraftFromDictionary', () => {
  const result = parseDictionaryResponse([
    {
      phonetics: [{ text: '/dɪˈsaɪd/', audio: 'https://x/decide-uk.mp3' }],
      meanings: [{ partOfSpeech: 'verb', definitions: [{ definition: 'To make a choice.' }] }],
    },
  ])

  it('uses the dictionary data and leaves the Spanish meaning to be typed', () => {
    const draft = buildDraftFromDictionary(' decide ', result)

    expect(draft).toMatchObject({
      lemma: 'decide',
      kind: 'word',
      ipa: '/dɪˈsaɪd/',
      audioUrl: 'https://x/decide-uk.mp3',
      origin: 'dictionary',
    })
    expect(draft.senses).toHaveLength(1)
    expect(draft.senses[0]).toMatchObject({ pos: 'verb', definitionEn: 'To make a choice.', meaningEs: '' })
  })

  it('falls back to a blank manual entry when the dictionary knows nothing', () => {
    const draft = buildDraftFromDictionary('go off on one', null)

    expect(draft).toMatchObject({ lemma: 'go off on one', kind: 'expression', ipa: '', origin: 'manual' })
    expect(draft.senses).toHaveLength(1)
    expect(draft.senses[0]?.pos).toBe('expression')
  })
})

describe('canSaveDraft', () => {
  const withMeaning = () => ({ ...buildDraftFromDictionary('decide', null), senses: [{ ...emptySense('verb'), meaningEs: 'decidir' }] })

  it('needs a word', () => {
    expect(canSaveDraft({ ...withMeaning(), lemma: '  ' }, 'pending_ai')).toBe(false)
  })

  it('lets an entry that will be completed later be saved with just its word', () => {
    expect(canSaveDraft(buildDraftFromDictionary('decide', null), 'pending_ai')).toBe(true)
  })

  it('needs a Spanish meaning when the entry is final', () => {
    expect(canSaveDraft(buildDraftFromDictionary('decide', null), 'active')).toBe(false)
    expect(canSaveDraft(withMeaning(), 'active')).toBe(true)
  })
})
