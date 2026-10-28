import type { CSSProperties, ReactNode } from 'react'

interface FlipCardProps {
  flipped: boolean
  front: ReactNode
  back: ReactNode
  /** Tapping the front turns the card. */
  onFrontTap?: () => void
}

const HALF_MS = 175

/**
 * A card that turns over in about 350 ms: the face that is leaving turns 90 degrees and
 * disappears, then the other one turns in from the other side with a little spring. It does not
 * use `backface-visibility`, which some Safari versions ignore (the back showed through the
 * front). The hidden face is `inert`, so keyboard and screen readers never reach it. With reduced
 * motion the faces swap at once.
 */
export function FlipCard({ flipped, front, back, onFrontTap }: FlipCardProps) {
  const face = 'absolute inset-0 rounded-sheet border border-border bg-surface motion-reduce:!transition-none'

  // The face on its way out goes first; the one coming in waits for it, then turns with an overshoot.
  const leaving = (visible: boolean, angle: number): CSSProperties => ({
    transform: `rotateY(${visible ? 0 : angle}deg)`,
    visibility: visible ? 'visible' : 'hidden',
    transition: visible
      ? `transform ${HALF_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${HALF_MS}ms, visibility 0s linear ${HALF_MS}ms`
      : `transform ${HALF_MS}ms ease-in, visibility 0s linear ${HALF_MS}ms`,
  })

  return (
    <div className="relative h-full [perspective:1400px]">
      <div
        className={`${face} ${onFrontTap && !flipped ? 'cursor-pointer' : ''}`}
        style={leaving(!flipped, 90)}
        inert={flipped}
        aria-hidden={flipped}
        onClick={flipped ? undefined : onFrontTap}
      >
        {front}
      </div>
      <div className={face} style={leaving(flipped, -90)} inert={!flipped} aria-hidden={!flipped}>
        {back}
      </div>
    </div>
  )
}
