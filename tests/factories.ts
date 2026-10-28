import { newId } from '../src/lib/id.ts'
import type { Card, Entry, Topic } from '../src/shared/index.ts'

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
