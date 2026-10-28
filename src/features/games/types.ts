import type { GameAnswer } from '../../games/record.ts'
import type { GameWord, PickOptions } from '../../games/words.ts'
import type { Entry, Source, Topic } from '../../shared/index.ts'

/** What a game hands back when it ends. */
export interface GameOutcome {
  /** Right answers (in Parejas: pairs found without a mistake). */
  score: number
  total: number
  durationMs: number
  /** The words answered wrong at least once. */
  missed: Entry[]
}

/** What every game screen receives: the words of the scope, the rest of the collection for wrong options, and how to report. */
export interface GamePlayProps {
  words: GameWord[]
  /** Every playable word, for wrong options. */
  pool: Entry[]
  /** Names of the topics and the sources, for the links of Conexiones. */
  topics: Topic[]
  sources: Source[]
  /** Times each word has been played in this game before. */
  turns: ReadonlyMap<string, number>
  variant: string
  pick: PickOptions
  autoPlayAudio: boolean
  /** Saves one answer (statistics, log and calendar effect). */
  record: (answer: GameAnswer) => void
  onFinish: (outcome: GameOutcome) => void
  onExit: () => void
}
