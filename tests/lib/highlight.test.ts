import { describe, expect, it } from 'vitest'
import { findHighlightTarget, formCandidates, splitHighlight } from '../../src/lib/highlight.ts'
import { makeEntry } from '../factories.ts'

describe('splitHighlight', () => {
  it('splits around the first whole-word match, ignoring letter case', () => {
    expect(splitHighlight('We Went to the pub', 'went')).toEqual({ before: 'We ', match: 'Went', after: ' to the pub' })
  })

  it('does not match inside a longer word', () => {
    expect(splitHighlight('Going is not the same as go', 'go')).toEqual({ before: 'Going is not the same as ', match: 'go', after: '' })
    expect(splitHighlight('Going home', 'go')).toBeNull()
    expect(splitHighlight('The cargo arrived', 'go')).toBeNull()
  })

  it('matches multi-word units and words with punctuation around them', () => {
    expect(splitHighlight('She went off on one when she saw the bill.', 'went off on one')?.match).toBe('went off on one')
    expect(splitHighlight('"Cheers!" he said.', 'cheers')?.match).toBe('Cheers')
  })

  it('treats the target as plain text, not as a regular expression', () => {
    expect(splitHighlight('What (the) heck?', '(the)')?.match).toBe('(the)')
    expect(splitHighlight('What the heck?', '(the)')).toBeNull()
    expect(splitHighlight('1 + 1 = 2, so a+b works', 'a+b')?.match).toBe('a+b')
    expect(splitHighlight('aab', 'a+b')).toBeNull()
  })

  it.each([undefined, '', '   '])('returns null for the empty target %j', (target) => {
    expect(splitHighlight('anything', target)).toBeNull()
  })

  it('works with accented letters around the word', () => {
    expect(splitHighlight('un café con leche', 'café')?.match).toBe('café')
    expect(splitHighlight('cafés', 'café')).toBeNull()
  })
})

describe('formCandidates', () => {
  it('lists what was typed, the lemma and every inflection, longest first and without repeats', () => {
    const entry = makeEntry({
      lemma: 'go',
      seenForm: 'went',
      forms: {
        verb: { base: 'go', thirdPerson: 'goes', pastSimple: ['went'], pastParticiple: ['gone'], presentParticiple: 'going', irregular: true },
        noun: { plural: 'goes', countability: 'countable' },
      },
    })

    expect(formCandidates(entry)).toEqual(['going', 'went', 'goes', 'gone', 'go'])
  })

  it('includes noun plurals and adjective degrees', () => {
    const entry = makeEntry({
      lemma: 'child',
      seenForm: undefined as never,
      forms: { noun: { plural: 'children', countability: 'countable' }, adjective: { comparative: 'better', superlative: 'best' } },
    })

    expect(formCandidates(entry)).toEqual(['children', 'better', 'child', 'best'])
  })
})

describe('findHighlightTarget', () => {
  const go = makeEntry({
    lemma: 'go',
    seenForm: 'went',
    forms: { verb: { base: 'go', thirdPerson: 'goes', pastSimple: ['went'], pastParticiple: ['gone'], presentParticiple: 'going', irregular: true } },
  })

  it('prefers the fragment the AI marked when it is in the sentence', () => {
    expect(findHighlightTarget('She went off on one when she saw the bill.', go, 'went off on one')).toBe('went off on one')
  })

  it('falls back to a known form when the marked fragment is not there', () => {
    expect(findHighlightTarget('We went to the pub.', go, 'gone')).toBe('went')
  })

  it('finds the form that actually appears, whatever the case', () => {
    expect(findHighlightTarget('Going out tonight?', go)).toBe('Going')
    expect(findHighlightTarget('It has gone.', go)).toBe('gone')
  })

  it('prefers the longest form when several appear', () => {
    expect(findHighlightTarget('He goes and she went', go)).toBe('went')
  })

  it('is undefined when no form of the word appears', () => {
    expect(findHighlightTarget('Nothing relevant here', go)).toBeUndefined()
  })
})
