import { describe, expect, it } from 'vitest'
import { seededRng } from '../../src/games/rng.ts'
import { acceptedForms, buildVerbRound, hasVerbForms, IRREGULAR_BOOST, isVerbAnswer, planVerbForms, regularPast, VERB_OPTIONS } from '../../src/games/verbForms.ts'
import { entryOf, pickOptions, verbOf, wordOf } from './helpers.ts'

const go = verbOf('go', ['went'], ['gone'])
const walk = verbOf('walk', ['walked'], ['walked'])
const learn = verbOf('learn', ['learnt', 'learned'], ['learnt', 'learned'])

describe('what counts as right', () => {
  it('accepts every listed form and the other spelling', () => {
    expect(acceptedForms(['learnt', 'learned']).sort()).toEqual(['learned', 'learnt'])
    expect(acceptedForms(['learnt']).sort()).toEqual(['learned', 'learnt'])
    expect(acceptedForms(['spelt']).sort()).toEqual(['spelled', 'spelt'])
    expect(acceptedForms(['dreamt']).sort()).toEqual(['dreamed', 'dreamt'])
    expect(acceptedForms(['went'])).toEqual(['went'])
  })

  it('does not accept "gotten" as a past simple, but does as a participle', () => {
    const round = buildVerbRound(verbOf('get', ['got'], ['got', 'gotten']), 'type', seededRng(1))
    expect(round && isVerbAnswer(round.pastSimple, 'got')).toBe(true)
    expect(round && isVerbAnswer(round.pastSimple, 'gotten')).toBe(false)
    expect(round && isVerbAnswer(round.pastParticiple, 'gotten')).toBe(true)
  })

  it('ignores case, spaces and a final full stop, and rejects an empty answer', () => {
    const round = buildVerbRound(go, 'type', seededRng(1))
    expect(round && isVerbAnswer(round.pastSimple, '  Went. ')).toBe(true)
    expect(round && isVerbAnswer(round.pastSimple, 'gone')).toBe(false)
    expect(round && isVerbAnswer(round.pastSimple, '')).toBe(false)
  })
})

describe('regularPast', () => {
  it.each([
    ['go', 'goed'],
    ['take', 'taked'],
    ['try', 'tried'],
    ['play', 'played'],
    ['give up', 'gived up'],
  ])('%s -> %s', (base, expected) => {
    expect(regularPast(base)).toBe(expected)
  })
})

describe('buildVerbRound', () => {
  it('needs both forms', () => {
    expect(hasVerbForms(go)).toBe(true)
    expect(hasVerbForms(entryOf('table', 'noun'))).toBe(false)
    expect(hasVerbForms(verbOf('go', [], ['gone']))).toBe(false)
    expect(buildVerbRound(entryOf('table', 'noun'), 'choose', seededRng(1))).toBeNull()
  })

  it('asks the past simple and the participle, with the verb and its meaning', () => {
    const round = buildVerbRound(go, 'choose', seededRng(1))
    expect(round).toMatchObject({ base: 'go', meaningEs: 'go (verbo)', irregular: true })
    expect(round?.pastSimple.shown).toBe('went')
    expect(round?.pastParticiple.shown).toBe('gone')
  })

  it('offers the right form and wrong forms of the same verb, the other past form and the invented "-ed" among them', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const round = buildVerbRound(go, 'choose', seededRng(seed))
      expect(round?.pastSimple.options).toHaveLength(VERB_OPTIONS)
      expect(round?.pastSimple.options).toContain('went')
      expect(round?.pastSimple.options).toContain('gone')
      expect(round?.pastSimple.options).toContain('goed')
      expect(round?.pastParticiple.options).toContain('went')
      expect(round?.pastParticiple.options).toContain('gone')
      expect(new Set(round?.pastSimple.options).size).toBe(VERB_OPTIONS)
    }
  })

  it('uses the base form, the -ing form and the third person for a regular verb', () => {
    const round = buildVerbRound(walk, 'choose', seededRng(3))
    expect([...(round?.pastSimple.options ?? [])].sort()).toEqual(['walk', 'walked', 'walking', 'walks'])
  })

  it('never offers a spelling that counts as right as a wrong option', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const round = buildVerbRound(learn, 'choose', seededRng(seed))
      const options = round?.pastSimple.options ?? []
      expect(options.filter((option) => ['learnt', 'learned'].includes(option))).toHaveLength(1)
      expect(round && options.filter((option) => isVerbAnswer(round.pastSimple, option))).toHaveLength(1)
    }
  })

  it('has no options when the answer is written', () => {
    const round = buildVerbRound(go, 'type', seededRng(1))
    expect(round?.pastSimple.options).toEqual([])
    expect(round?.pastParticiple.options).toEqual([])
  })

  it('shows the meaning of the verb sense even when another sense comes first', () => {
    const noun = { ...(go.senses[0] as (typeof go.senses)[number]), id: 'n', pos: 'noun' as const, meaningEs: 'turno', matchesContext: true }
    const entry = { ...go, senses: [noun, ...go.senses.map((sense) => ({ ...sense, matchesContext: false }))] }
    expect(buildVerbRound(entry, 'choose', seededRng(1))?.meaningEs).toBe('go (verbo)')
  })
})

describe('planVerbForms', () => {
  it('draws the irregular verbs more often than the regular ones', () => {
    const irregular = ['go', 'take', 'eat', 'see', 'run', 'sing', 'drink', 'write'].map((base) => wordOf(verbOf(base, [`${base}-past`], [`${base}-part`])))
    const regular = ['walk', 'talk', 'jump', 'play', 'help', 'call', 'open', 'work'].map((base) => wordOf(verbOf(base, [`${base}ed`], [`${base}ed`])))
    const words = [...irregular, ...regular]
    let irregularPicked = 0
    for (let seed = 0; seed < 100; seed += 1) {
      const rounds = planVerbForms(words, { level: 'choose', pick: pickOptions({ rng: seededRng(seed) }) })
      irregularPicked += rounds.filter((round) => round.irregular).length
    }
    // Ten of sixteen words per game: with equal odds irregulars would be 5 per game.
    expect(irregularPicked / 100).toBeGreaterThan(6)
    expect(IRREGULAR_BOOST).toBeGreaterThan(1)
  })

  it('leaves out words that are not verbs and makes at most ten rounds', () => {
    const verbs = Array.from({ length: 12 }, (_, i) => wordOf(verbOf(`verb${i}`, [`past${i}`], [`part${i}`])))
    const rounds = planVerbForms([...verbs, wordOf(entryOf('table', 'noun'))], { level: 'type', pick: pickOptions() })
    expect(rounds).toHaveLength(10)
    expect(rounds.every((round) => round.entry.lemma.startsWith('verb'))).toBe(true)
  })
})
