import { describe, expect, it } from 'vitest'
import { buildClozeRound, CLOZE_OPTIONS, hasClozeGap, isClozeAnswer, planCloze } from '../../src/games/cloze.ts'
import { seededRng } from '../../src/games/rng.ts'
import { entryOf, pickOptions, senseOf, verbOf, wordOf } from './helpers.ts'

const go = verbOf('go', ['went'], ['gone'], {
  contexts: [{ id: 'c1', sentence: 'We went to the pub after work.', translationEs: 'Fuimos al pub.', surface: 'went', addedAt: 1 }],
})
const others = [verbOf('take', ['took'], ['taken']), verbOf('eat', ['ate'], ['eaten']), verbOf('see', ['saw'], ['seen']), entryOf('table', 'noun')]
const pool = [go, ...others]

describe('buildClozeRound', () => {
  it('uses the sentence of the user first, with the word in the form it was written', () => {
    const round = buildClozeRound(go, { level: 'choose', pool, turn: 0, rng: seededRng(1) })
    expect(round).toMatchObject({ before: 'We ', answer: 'went', after: ' to the pub after work.', translationEs: 'Fuimos al pub.', own: true })
  })

  it('goes round the sentences as the word is played again, examples of every sense included', () => {
    const answers = [0, 1, 2, 3, 4].map((turn) => buildClozeRound(go, { level: 'type', pool, turn, rng: seededRng(1) })?.answer)
    expect(answers[0]).toBe('went')
    expect(new Set(answers).size).toBeGreaterThan(1)
    expect(answers[3]).toBe(answers[0]) // three sentences: the user's own and two examples
    expect(buildClozeRound(go, { level: 'type', pool, turn: 1, rng: seededRng(1) })?.own).toBe(false)
  })

  it('offers four different options in level 1, with the right form and the wrong form of the same word', () => {
    for (let seed = 0; seed < 25; seed += 1) {
      const round = buildClozeRound(go, { level: 'choose', pool, turn: 0, rng: seededRng(seed) })
      expect(round?.options).toHaveLength(CLOZE_OPTIONS)
      expect(new Set(round?.options.map((option) => option.toLowerCase())).size).toBe(CLOZE_OPTIONS)
      expect(round?.options).toContain('went')
      expect(round?.options).toContain('go')
    }
  })

  it('shuffles where the answer sits', () => {
    const positions = new Set<number>()
    for (let seed = 0; seed < 40; seed += 1) {
      positions.add(buildClozeRound(go, { level: 'choose', pool, turn: 0, rng: seededRng(seed) })?.options.indexOf('went') ?? -1)
    }
    expect(positions.size).toBeGreaterThan(2)
  })

  it('has no options when the answer is written', () => {
    expect(buildClozeRound(go, { level: 'type', pool, turn: 0, rng: seededRng(1) })?.options).toEqual([])
  })

  it('gives up on a word when the collection is too small for four options, and falls back to base forms before that', () => {
    expect(buildClozeRound(go, { level: 'choose', pool: [go], turn: 0, rng: seededRng(1) })).toBeNull()
    // Two other words are enough: "go" (wrong form), their past forms and, to fill up, their base forms.
    const small = buildClozeRound(go, { level: 'choose', pool: [go, others[0] as (typeof others)[number]], turn: 0, rng: seededRng(1) })
    expect([...(small?.options ?? [])].sort()).toEqual(['go', 'take', 'took', 'went'])
  })

  it('has nothing to ask when the word is in none of its sentences', () => {
    const lost = entryOf('apple', 'noun', { senses: [senseOf({ examples: [{ en: 'It was delicious.', es: 'Estaba rica.' }] })] })
    expect(hasClozeGap(lost)).toBe(false)
    expect(buildClozeRound(lost, { level: 'type', pool, turn: 0, rng: seededRng(1) })).toBeNull()
  })

  it('accepts the other spelling and the verb variants as right', () => {
    const colour = entryOf('colour', 'noun', { senses: [senseOf({ examples: [{ en: 'I love this colour.', es: 'Me encanta este color.', target: 'colour' }] })] })
    const round = buildClozeRound(colour, { level: 'type', pool: [colour], turn: 0, rng: seededRng(1) })
    expect(round).not.toBeNull()
    if (!round) return
    expect(isClozeAnswer(round, 'color')).toBe(true)
    expect(isClozeAnswer(round, 'Colour')).toBe(true)
    expect(isClozeAnswer(round, 'colours')).toBe(false)
  })
})

describe('planCloze', () => {
  const many = Array.from({ length: 14 }, (_, i) => verbOf(`verb${i}`, [`past${i}`], [`part${i}`]))
  const words = many.map((entry) => wordOf(entry))
  const plan = { level: 'choose' as const, pool: many, turns: new Map<string, number>(), pick: pickOptions() }

  it('makes ten rounds with ten different words', () => {
    const rounds = planCloze(words, plan)
    expect(rounds).toHaveLength(10)
    expect(new Set(rounds.map((round) => round.entry.id)).size).toBe(10)
    expect(rounds.every((round) => round.options.includes(round.answer))).toBe(true)
  })

  it('makes fewer rounds when there are fewer words, and skips words without a sentence to use', () => {
    const lost = wordOf(entryOf('apple', 'noun', { senses: [senseOf({ examples: [{ en: 'It was delicious.', es: 'Estaba rica.' }] })] }))
    expect(planCloze([...words.slice(0, 5), lost], plan)).toHaveLength(5)
  })

  it('puts the words failed in a review in the game even when they would rarely be drawn', () => {
    const crowd = Array.from({ length: 40 }, (_, i) => wordOf(verbOf(`crowd${i}`, [`cp${i}`], [`cq${i}`])))
    const focus = new Set([crowd[7]?.entry.id ?? '', crowd[31]?.entry.id ?? ''])
    for (let seed = 0; seed < 15; seed += 1) {
      const rounds = planCloze(crowd, { ...plan, pool: crowd.map((word) => word.entry), pick: pickOptions({ rng: seededRng(seed), focusIds: focus }) })
      expect(rounds).toHaveLength(10)
      expect([...focus].every((id) => rounds.some((round) => round.entry.id === id))).toBe(true)
    }
  })

  it('moves to the next sentence of a word that was played before', () => {
    const first = planCloze([wordOf(go)], { ...plan, level: 'type', pool })
    const again = planCloze([wordOf(go)], { ...plan, level: 'type', pool, turns: new Map([[go.id, 2]]) })
    expect(first[0]?.answer).toBe('went')
    expect(again[0]?.answer).toBe('go')
  })
})
