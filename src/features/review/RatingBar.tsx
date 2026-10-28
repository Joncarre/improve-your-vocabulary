import { Button } from '../../ui/Button.tsx'
import type { Grade, GradePreview } from '../../srs/scheduler.ts'

const BUTTONS: ReadonlyArray<{ grade: Grade; label: string; tone: string }> = [
  { grade: 1, label: 'Otra vez', tone: 'border-again/40 bg-again/10 text-again' },
  { grade: 2, label: 'Difícil', tone: 'border-hard/40 bg-hard/10 text-hard' },
  { grade: 3, label: 'Bien', tone: 'border-good/40 bg-good/10 text-good' },
  { grade: 4, label: 'Fácil', tone: 'border-easy/40 bg-easy/10 text-easy' },
]

interface RatingBarProps {
  revealed: boolean
  /** Text of the button that turns the card ("Mostrar respuesta", "Comprobar"). */
  revealLabel: string
  onReveal: () => void
  /** The four intervals; absent in an extra review, where only "Otra vez" and "Bien" are offered. */
  preview: Record<Grade, GradePreview> | undefined
  /** The rating the app proposes after a written answer. */
  suggested: Grade | null
  busy: boolean
  onGrade: (grade: Grade) => void
}

/** Always the same height: "Mostrar respuesta" is replaced by the four buttons, so nothing jumps. */
export function RatingBar({ revealed, revealLabel, onReveal, preview, suggested, busy, onGrade }: RatingBarProps) {
  if (!revealed) {
    return (
      <Button variant="primary" className="h-14 w-full text-[16px]" onClick={onReveal}>
        {revealLabel}
      </Button>
    )
  }

  const buttons = preview ? BUTTONS : BUTTONS.filter((button) => button.grade === 1 || button.grade === 3)
  return (
    <div className={`grid gap-2 ${preview ? 'grid-cols-4' : 'grid-cols-2'}`}>
      {buttons.map((button) => (
        <button
          key={button.grade}
          type="button"
          disabled={busy}
          aria-label={preview ? `${button.label}, ${preview[button.grade].label}` : button.label}
          onClick={() => onGrade(button.grade)}
          className={`flex h-14 flex-col items-center justify-center rounded-control border transition-opacity active:opacity-70 disabled:opacity-50 ${button.tone} ${
            suggested === button.grade ? 'ring-2 ring-current ring-offset-2 ring-offset-bg' : ''
          }`}
        >
          <span className="text-body font-semibold leading-tight">{button.label}</span>
          {preview ? <span className="text-caption leading-tight opacity-80">{preview[button.grade].label}</span> : null}
        </button>
      ))}
    </div>
  )
}
