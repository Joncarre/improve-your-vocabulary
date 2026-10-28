import type { Entry, PartOfSpeech, Sense } from '../../shared/index.ts'

const POS_SHORT: Record<PartOfSpeech, string> = {
  noun: 'n.',
  verb: 'v.',
  adjective: 'adj.',
  adverb: 'adv.',
  preposition: 'prep.',
  conjunction: 'conj.',
  pronoun: 'pron.',
  determiner: 'det.',
  interjection: 'interj.',
  phrasal_verb: 'phr. v.',
  idiom: 'expr.',
  expression: 'expr.',
}

/** The forms of the word in one line: "go · goes · went · gone · going". Empty when it has none. */
export function formsLine(entry: Pick<Entry, 'forms'>): string {
  const { verb, noun, adjective } = entry.forms ?? {}
  const forms = [
    verb?.base,
    verb?.thirdPerson,
    ...(verb?.pastSimple ?? []),
    ...(verb?.pastParticiple ?? []),
    verb?.presentParticiple,
    noun?.plural,
    adjective?.comparative,
    adjective?.superlative,
  ].filter((form): form is string => Boolean(form?.trim()))
  return [...new Set(forms)].join(' · ')
}

/** The word family in one line: "outgoing (adj.) · going (n.)". */
export function familyLine(entry: Pick<Entry, 'family'>): string {
  return entry.family.map((member) => `${member.word} (${POS_SHORT[member.pos]})`).join(' · ')
}

/** The other meanings of the word, so a card for one sense reminds you that there are more. */
export function otherMeanings(entry: Pick<Entry, 'senses'>, current: Pick<Sense, 'id'> | undefined): string[] {
  return [...new Set(entry.senses.filter((sense) => sense.id !== current?.id).map((sense) => sense.meaningEs.trim()).filter(Boolean))]
}

/** "45 s", "3 min 07 s". */
export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`
}
