import { Check, Gamepad2, X } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { Button } from '../../ui/Button.tsx'
import { EmptyState } from '../../ui/EmptyState.tsx'

export type OptionState = 'idle' | 'correct' | 'wrong' | 'dim'

const OPTION_STATES: Record<OptionState, string> = {
  idle: 'border-border bg-surface active:bg-surface-2',
  correct: 'border-good bg-good/15',
  wrong: 'border-again bg-again/15',
  dim: 'border-border bg-surface opacity-50',
}

interface OptionButtonProps {
  /** 1 to 4: the key that picks it on a keyboard. */
  shortcut?: number
  state: OptionState
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

/** An answer to choose: at least 48 px tall, with the number key shown on desktop. */
export function OptionButton({ shortcut, state, disabled = false, onClick, children }: OptionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-12 w-full items-center gap-3 rounded-card border px-3 py-2 text-left text-[17px] transition-colors motion-reduce:transition-none ${OPTION_STATES[state]}`}
    >
      {shortcut === undefined ? null : (
        <span aria-hidden="true" className="hidden size-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-caption text-text-3 lg:inline-flex">
          {shortcut}
        </span>
      )}
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</span>
      {state === 'correct' ? <Check size={18} className="shrink-0 text-good" aria-label="Correcta" /> : null}
      {state === 'wrong' ? <X size={18} className="shrink-0 text-again" aria-label="Incorrecta" /> : null}
    </button>
  )
}

/** Green or red verdict under an answer. */
export function ResultBanner({ correct, children }: { correct: boolean; children: ReactNode }) {
  return (
    <div role="status" className={`rounded-card border px-3 py-2 ${correct ? 'border-good/40 bg-good/10 text-good' : 'border-again/40 bg-again/10 text-again'}`}>
      {children}
    </div>
  )
}

/** The button under an answered round. */
export function NextBar({ last, onNext }: { last: boolean; onNext: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pt-1">
      <Button variant="primary" className="h-12 w-full text-[16px]" onClick={onNext} autoFocus>
        {last ? 'Ver resultado' : 'Siguiente'}
      </Button>
      <p className="mt-1.5 hidden text-center text-caption text-text-3 lg:block">Intro para seguir · Esc salir</p>
    </div>
  )
}

interface GapSentenceProps {
  before: string
  after: string
  /** The width of the gap, from the length of the answer. */
  length: number
  /** Once answered, the word that goes in the gap and how it went. */
  reveal?: { text: string; tone: 'good' | 'again' }
  /** Text shown after the gap, such as the base word in brackets. */
  hint?: string
}

/** A sentence with a gap, or with the word filled in once the round is answered. */
export function GapSentence({ before, after, length, reveal, hint }: GapSentenceProps) {
  return (
    <p className="text-[22px] leading-snug [overflow-wrap:anywhere]">
      {before}
      {reveal ? (
        <mark className={`bg-transparent font-semibold ${reveal.tone === 'good' ? 'text-good' : 'text-again'}`}>{reveal.text}</mark>
      ) : (
        <span aria-label="hueco" style={{ width: `${Math.min(14, Math.max(4, length))}ch` }} className="mx-0.5 inline-block border-b-2 border-accent align-baseline">
          &nbsp;
        </span>
      )}
      {after}
      {hint ? <span className="ml-1.5 text-secondary text-text-3">({hint})</span> : null}
    </p>
  )
}

interface AnswerInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  label: string
  disabled?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  /** Move on to another field instead of sending (the first of two). */
  enterKeyHint?: 'done' | 'next'
}

/** A text field for an English answer: no capitals, no autocorrect, no spell checker. */
export function AnswerInput({ value, onChange, onSubmit, label, disabled = false, inputRef, enterKeyHint = 'done' }: AnswerInputProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label className="block">
        <span className="mb-1 block text-caption text-text-3">{label}</span>
        <input
          ref={inputRef}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          lang="en"
          enterKeyHint={enterKeyHint}
          className="h-12 w-full min-w-0 rounded-control border border-border bg-surface-2 px-3 text-[17px] text-text placeholder:text-text-3 disabled:opacity-60"
        />
      </label>
    </form>
  )
}

/** When a game could not build a single round (the words have nothing to play with in this version). */
export function NothingToPlay({ onExit }: { onExit: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[560px] flex-1 px-4">
      <EmptyState
        icon={Gamepad2}
        title="No se ha podido preparar la partida"
        action={
          <Button variant="primary" onClick={onExit}>
            Volver
          </Button>
        }
      >
        Las palabras de este alcance no tienen lo necesario para este juego.
      </EmptyState>
    </div>
  )
}
