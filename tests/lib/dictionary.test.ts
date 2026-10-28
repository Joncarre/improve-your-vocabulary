import { describe, expect, it, vi } from 'vitest'
import { isUkAudio, lookupDictionary, parseDictionaryResponse } from '../../src/lib/dictionary.ts'

const BASE = 'https://api.dictionaryapi.dev/media/pronunciations/en'

const decide = [
  {
    word: 'decide',
    phonetic: '/dɪˈsaɪd/',
    phonetics: [{ text: '/dɪˈsaɪd/', audio: `${BASE}/decide-us.mp3` }],
    meanings: [
      {
        partOfSpeech: 'verb',
        definitions: [
          { definition: 'To make a choice.', example: 'She decided to leave.', synonyms: ['choose'], antonyms: [] },
          { definition: 'To resolve.', synonyms: [], antonyms: [] },
        ],
        synonyms: ['determine'],
        antonyms: ['hesitate'],
      },
    ],
  },
]

const learnt = [
  {
    word: 'learnt',
    phonetics: [
      { audio: `${BASE}/learnt-au.mp3` },
      { text: 'lɜːnt', audio: `${BASE}/learnt-uk.mp3` },
      { text: '/lɝnt/', audio: `${BASE}/learnt-us.mp3` },
    ],
    meanings: [{ partOfSpeech: 'exclamation', definitions: [{ definition: 'Past of learn.' }] }],
  },
]

describe('isUkAudio', () => {
  it.each([
    [`${BASE}/learnt-uk.mp3`, true],
    [`${BASE}/colour_gb_1.mp3`, true],
    [`${BASE}/decide-us.mp3`, false],
    [`${BASE}/colour-au.mp3`, false],
    ['', false],
    [undefined, false],
  ])('%s -> %s', (url, expected) => {
    expect(isUkAudio(url)).toBe(expected)
  })
})

describe('parseDictionaryResponse', () => {
  it('reads IPA, definitions, examples and synonyms', () => {
    const result = parseDictionaryResponse(decide)

    expect(result?.ipa).toBe('/dɪˈsaɪd/')
    expect(result?.senses).toEqual([
      { pos: 'verb', definitionEn: 'To make a choice.', examples: [{ en: 'She decided to leave.', es: '' }] },
    ])
    expect(result?.synonyms).toEqual(['determine', 'choose'])
    expect(result?.antonyms).toEqual(['hesitate'])
  })

  it('never offers a recording that is not British', () => {
    expect(parseDictionaryResponse(decide)?.audioUrl).toBe('')
  })

  it('prefers the British IPA and recording, and wraps the IPA in slashes', () => {
    const result = parseDictionaryResponse(learnt)

    expect(result?.ipa).toBe('/lɜːnt/')
    expect(result?.audioUrl).toBe(`${BASE}/learnt-uk.mp3`)
  })

  it('maps unusual parts of speech', () => {
    expect(parseDictionaryResponse(learnt)?.senses[0]?.pos).toBe('interjection')
    const odd = [{ phonetics: [], meanings: [{ partOfSpeech: 'abbreviation', definitions: [{ definition: 'x' }] }] }]
    expect(parseDictionaryResponse(odd)?.senses[0]?.pos).toBe('expression')
  })

  it('keeps at most four senses', () => {
    const meanings = Array.from({ length: 6 }, (_, i) => ({ partOfSpeech: 'noun', definitions: [{ definition: `d${i}` }] }))
    expect(parseDictionaryResponse([{ phonetics: [], meanings }])?.senses).toHaveLength(4)
  })

  it.each([
    ['an empty list', []],
    ['the "not found" object', { title: 'No Definitions Found' }],
    ['garbage', 'nope'],
  ])('returns null for %s', (_label, json) => {
    expect(parseDictionaryResponse(json)).toBeNull()
  })
})

describe('lookupDictionary', () => {
  const respond = (status: number, body: unknown) =>
    vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status }))

  it('asks the free dictionary for the lower-cased, encoded word', async () => {
    const fetchImpl = respond(200, decide)
    await lookupDictionary(' Give Up ', { fetchImpl })

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.dictionaryapi.dev/api/v2/entries/en/give%20up')
  })

  it('parses a good answer', async () => {
    expect((await lookupDictionary('decide', { fetchImpl: respond(200, decide) }))?.ipa).toBe('/dɪˈsaɪd/')
  })

  it('resolves to null for an unknown word, a failing service or no connection', async () => {
    expect(await lookupDictionary('zzzz', { fetchImpl: respond(404, { title: 'No Definitions Found' }) })).toBeNull()
    expect(await lookupDictionary('x', { fetchImpl: respond(502, {}) })).toBeNull()
    expect(
      await lookupDictionary('x', {
        fetchImpl: async () => {
          throw new TypeError('Failed to fetch')
        },
      }),
    ).toBeNull()
  })
})
