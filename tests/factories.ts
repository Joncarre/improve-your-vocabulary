import { newId } from '../src/lib/id.ts'
import type { Card, Entry, EnrichOutput, ReviewLog, Source, Topic } from '../src/shared/index.ts'

/** A realistic model answer for "went" in "We went to the pub after work." */
export function makeEnrichOutput(overrides: Partial<EnrichOutput> = {}): EnrichOutput {
  return {
    lemma: 'go',
    kind: 'word',
    inflectionNote: '«went» es el pasado simple de «go»',
    ipa: '/ɡəʊ/',
    senses: [
      {
        pos: 'verb',
        meaningEs: 'ir',
        definitionEn: 'to move or travel to a place',
        register: 'neutral',
        examples: [
          { en: 'We went to the cinema on Saturday night.', es: 'Fuimos al cine el sábado por la noche.', target: 'went' },
          { en: 'I usually go to work by bus.', es: 'Normalmente voy al trabajo en autobús.', target: 'go' },
        ],
        matchesContext: true,
      },
      {
        pos: 'noun',
        meaningEs: 'turno',
        definitionEn: 'a chance to do something in turn',
        register: 'neutral',
        examples: [{ en: "It's your go.", es: 'Es tu turno.', target: 'go' }],
        matchesContext: false,
      },
    ],
    forms: {
      verb: {
        base: 'go',
        thirdPerson: 'goes',
        pastSimple: ['went'],
        pastParticiple: ['gone'],
        presentParticiple: 'going',
        irregular: true,
      },
      noun: { plural: 'goes', countability: 'countable' },
      adjective: null,
    },
    family: [{ word: 'outgoing', pos: 'adjective', meaningEs: 'sociable', example: 'She is very outgoing.' }],
    synonyms: ['travel', 'move'],
    antonyms: ['come', 'stay'],
    collocations: ['go home', 'go abroad'],
    learnerNote: '',
    usNote: '',
    cefr: 'A1',
    topicIds: [],
    newTopic: { nameEs: 'En el pub', emoji: '🍺' },
    alternativeUnit: '',
    contextTranslationEs: 'Fuimos al pub después del trabajo.',
    contextSurface: 'went',
    ...overrides,
  }
}

export function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return { id: newId(), nameEs: 'En el pub', emoji: '🍺', color: '#f3d58a', updatedAt: 0, ...overrides }
}

export function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: newId(),
    lemma: 'go',
    lemmaKey: 'go',
    seenForm: 'went',
    kind: 'word',
    ipa: '/ɡəʊ/',
    senses: [
      {
        id: newId(),
        pos: 'verb',
        meaningEs: 'ir',
        definitionEn: 'to move from one place to another',
        register: 'neutral',
        examples: [
          {
            en: 'We went to the pub after work.',
            es: 'Fuimos al pub después del trabajo.',
            target: 'went',
          },
        ],
        matchesContext: true,
      },
    ],
    family: [],
    synonyms: [],
    antonyms: [],
    collocations: [],
    topicIds: [],
    contexts: [],
    status: 'active',
    isLeech: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

export function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: newId(),
    entryId: newId(),
    type: 'recognition',
    fsrs: {
      due: 1_000,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 0,
    },
    due: 1_000,
    unlocked: true,
    suspended: false,
    stats: { seen: 0, correct: 0, wrong: 0, streak: 0 },
    updatedAt: 1,
    ...overrides,
  }
}

export function makeLog(overrides: Partial<ReviewLog> = {}): ReviewLog {
  return {
    id: newId(),
    cardId: newId(),
    entryId: newId(),
    at: 1_000,
    origin: 'review',
    rating: 3,
    correct: true,
    ms: 4_000,
    updatedAt: 1_000,
    ...overrides,
  }
}

export function makeSource(overrides: Partial<Source> = {}): Source {
  return { id: newId(), title: 'Peaky Blinders', type: 'series', lastUsedAt: 1, updatedAt: 1, ...overrides }
}
