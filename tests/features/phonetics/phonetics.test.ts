import { describe, expect, it } from 'vitest'
import { distinctItems, hasUnknownSymbols, tokenizeIpa } from '../../../src/features/phonetics/ipa.ts'
import {
  GROUP_INFO,
  MARKS,
  PITFALLS,
  SOUNDS,
  soundsInGroup,
  type SoundGroup,
} from '../../../src/features/phonetics/sounds.ts'

const symbols = (ipa: string) =>
  tokenizeIpa(ipa).map((token) => (token.kind === 'space' ? ' ' : token.text))

describe('the table of sounds', () => {
  it('has no repeated symbol', () => {
    const all = [...SOUNDS.map((s) => s.symbol), ...MARKS.map((m) => m.symbol)]
    expect(new Set(all).size).toBe(all.length)
  })

  it('explains every sound with a hint, a tip and example words with their IPA', () => {
    for (const sound of SOUNDS) {
      expect(sound.hint.trim(), sound.symbol).not.toBe('')
      expect(sound.tip.trim(), sound.symbol).not.toBe('')
      expect(sound.examples.length, sound.symbol).toBeGreaterThanOrEqual(2)
      for (const example of sound.examples) {
        expect(example.word, sound.symbol).toMatch(/^[A-Za-z]+$/)
        expect(example.ipa, example.word).toMatch(/^\/.+\/$/)
      }
    }
  })

  it('puts every example word under a symbol its own transcription contains', () => {
    for (const sound of SOUNDS) {
      for (const example of sound.examples) {
        const used = tokenizeIpa(example.ipa).filter((token) => token.kind === 'sound').map((token) => token.text)
        expect(used, `${example.word} ${example.ipa} under /${sound.symbol}/`).toContain(sound.symbol)
      }
    }
  })

  it('transcribes every example word with symbols the guide knows', () => {
    const words = [
      ...SOUNDS.flatMap((s) => s.examples),
      ...MARKS.flatMap((m) => m.examples),
      ...PITFALLS.flatMap((p) => p.words),
    ]
    for (const example of words) expect(hasUnknownSymbols(tokenizeIpa(example.ipa)), `${example.word} ${example.ipa}`).toBe(false)
  })

  it('has every group, each with something in it', () => {
    for (const group of Object.keys(GROUP_INFO) as SoundGroup[]) expect(soundsInGroup(group).length, group).toBeGreaterThan(0)
  })

  it('writes the g with the IPA letter (U+0261), the one the AI and the dictionary return', () => {
    expect(SOUNDS.some((sound) => sound.symbol === 'ɡ')).toBe(true)
    expect(SOUNDS.some((sound) => sound.symbol === 'g')).toBe(false)
  })

  it('has the 24 consonants and 20 vowel sounds of British English', () => {
    expect(soundsInGroup('familiar').length + soundsInGroup('careful').length).toBe(24)
    // 12 vowels (incl. weak i and u) + 8 diphthongs
    expect(soundsInGroup('shortVowel').length + soundsInGroup('longVowel').length).toBe(14)
    expect(soundsInGroup('diphthong').length).toBe(8)
  })
})

describe('tokenizeIpa', () => {
  it('splits a simple word into sounds', () => {
    expect(symbols('/ɡəʊ/')).toEqual(['ɡ', 'əʊ'])
    expect(symbols('/ʃiːp/')).toEqual(['ʃ', 'iː', 'p'])
  })

  it('reads the stress mark as its own token', () => {
    const tokens = tokenizeIpa('/ˈnækəd/')
    expect(tokens.map((t) => t.kind)).toEqual(['stress', 'sound', 'sound', 'sound', 'sound', 'sound'])
    expect(symbols('/ˈnækəd/')).toEqual(['ˈ', 'n', 'æ', 'k', 'ə', 'd'])
    expect(symbols('/ˌedʒuˈkeɪʃn/')).toEqual(['ˌ', 'e', 'dʒ', 'u', 'ˈ', 'k', 'eɪ', 'ʃ', 'n'])
  })

  it('reads the affricates and diphthongs before their parts', () => {
    expect(symbols('/tʃɜːtʃ/')).toEqual(['tʃ', 'ɜː', 'tʃ'])
    expect(symbols('/dʒʌdʒ/')).toEqual(['dʒ', 'ʌ', 'dʒ'])
    expect(symbols('/hɪə/')).toEqual(['h', 'ɪə'])
    expect(symbols('/ˈɪnfluəns/')).toEqual(['ˈ', 'ɪ', 'n', 'f', 'l', 'u', 'ə', 'n', 's'])
  })

  it('keeps the gaps between the words of an expression', () => {
    expect(symbols('/ɡəʊ ɒf ɒn wʌn/')).toEqual(['ɡ', 'əʊ', ' ', 'ɒ', 'f', ' ', 'ɒ', 'n', ' ', 'w', 'ʌ', 'n'])
    // never a gap at the ends, never two in a row
    expect(symbols('/ ɡəʊ   ɒf /')).toEqual(['ɡ', 'əʊ', ' ', 'ɒ', 'f'])
  })

  it('accepts the other ways dictionaries write the same sounds', () => {
    expect(symbols('/ˈlɒɹi/')).toEqual(symbols('/ˈlɒri/')) // ɹ
    expect(symbols('/bɛd/')).toEqual(['b', 'e', 'd']) // ɛ
    expect(symbols('/gəʊ/')).toEqual(['ɡ', 'əʊ']) // ASCII g
    expect(symbols('/t͡ʃɪp/')).toEqual(['tʃ', 'ɪ', 'p']) // tie bar
    expect(symbols("/'nækəd/")).toEqual(['ˈ', 'n', 'æ', 'k', 'ə', 'd']) // ASCII apostrophe
    expect(symbols('/ˈbʌtn̩/')).toEqual(['ˈ', 'b', 'ʌ', 't', 'n']) // syllabic n
    expect(symbols('/ˈmedɪk(ə)l/')).toEqual(['ˈ', 'm', 'e', 'd', 'ɪ', 'k', 'ə', 'l']) // optional sound
    expect(symbols('[ˈfɪŋɡə]')).toEqual(['ˈ', 'f', 'ɪ', 'ŋ', 'ɡ', 'ə']) // square brackets
  })

  it('flags what it does not know instead of dropping it', () => {
    const tokens = tokenizeIpa('/ɡoʊ/') // American GOAT vowel: o is not a British symbol
    expect(hasUnknownSymbols(tokens)).toBe(true)
    expect(tokens.filter((t) => t.kind === 'unknown').map((t) => t.text)).toEqual(['o'])
    expect(hasUnknownSymbols(tokenizeIpa('/ɡəʊ/'))).toBe(false)
  })

  it('has nothing to say about an empty transcription', () => {
    expect(tokenizeIpa('')).toEqual([])
    expect(tokenizeIpa('//')).toEqual([])
  })

  it('recognises every symbol in a spread of real British transcriptions', () => {
    const real = [
      '/ɡəʊ/', '/ˈnækəd/', '/ˈlɒri/', '/dɪˈsɪʒn/', '/ʃiːp/', '/θɪŋk/', '/ðɪs/', '/ˈwɔːtə/', '/ˌsɪtʃuˈeɪʃn/',
      '/ˈhæpi/', '/bɜːd/', '/ˈtʃɪldrən/', '/ˈveri/', '/ˈkɒfi/', '/əˈbaʊt/', '/ˈbjuːtɪfl/', '/ˈjestədeɪ/',
      '/ˈenəmi/', '/tʃeə/', '/pjʊə/', '/ˈmʌni/', '/ˈsʌmθɪŋ/', '/ˈbrekfəst/', '/ˌɪnfəˈmeɪʃn/', '/ˈæŋɡri/',
      '/ˈsɪŋə/', '/ˈfɪŋɡə/', '/ɡəʊ ɒf ɒn wʌn/', '/ɡɪv ʌp/', '/ˈɪntrəstɪŋ/', '/ˈkʌmftəbl/', '/ˈaɪərn/',
      '/ˈvɒkæbjələri/', '/əˈkɒmpəniɪŋ/', '/ˈlʌvli/', '/ɪɡˈzæm/', '/ˈɔːfn/', '/ˌbɪlɪˈviː/', '/ˈɑːftənuːn/',
    ]
    for (const ipa of real) {
      const unknown = tokenizeIpa(ipa).filter((token) => token.kind === 'unknown').map((token) => token.text)
      expect(unknown, ipa).toEqual([])
    }
  })
})

describe('distinctItems', () => {
  it('lists each different sound once, in order of first appearance, with the stress mark', () => {
    expect(distinctItems(tokenizeIpa('/ɡəʊ ɒf ɒn wʌn/')).map((item) => item.text)).toEqual(['ɡ', 'əʊ', 'ɒ', 'f', 'n', 'w', 'ʌ'])
    expect(distinctItems(tokenizeIpa('/ˈnækəd/')).map((item) => item.text)).toEqual(['ˈ', 'n', 'æ', 'k', 'ə', 'd'])
  })

  it('ignores gaps and unknown symbols', () => {
    expect(distinctItems(tokenizeIpa('/ɡoʊ/')).map((item) => item.text)).toEqual(['ɡ', 'ʊ'])
  })
})
