import type { ReactNode } from 'react'
import { useElementWidth } from '../../lib/useElementWidth.ts'
import { barGeometry, ringDash, tickPlacement } from './geometry.ts'

/*
 * Charts of Progreso: plain SVG and HTML in the pastel palette, no library. Colours come from the design
 * tokens (`text-*` sets the colour and `currentColor` paints with it), and the drawing is made at the real
 * width of its box, so bars and corners are never stretched. Nothing is spoken twice: the drawing is hidden from
 * screen readers and a table with the same numbers (and a caption) takes its place for them.
 */

export interface Bar {
  key: string
  value: number
  /** What the bar is, in words ("martes 28 de octubre"): the tooltip and the row of the table. */
  label: string
  /** Painted in a stronger colour (today, the current week). */
  strong?: boolean
}

export interface Tick {
  /** Index of the bar it names. */
  index: number
  text: string
}

interface BarChartProps {
  bars: readonly Bar[]
  /** A sentence with what the chart says, for screen readers. */
  caption: string
  /** The two columns of the table for screen readers ("Día", "Repasos"). */
  columns: readonly [string, string]
  /** "3 repasos": how a value reads in a tooltip and in the table. */
  valueLabel: (value: number) => string
  ticks: readonly Tick[]
  /** Colour of the bars as a text colour class; the strong ones use the accent. */
  tone: string
  height?: number
  gap?: number
}

const ALIGN = { start: 'left-0', center: '-translate-x-1/2', end: 'right-0' } as const

export function BarChart({ bars, caption, columns, valueLabel, ticks, tone, height = 104, gap = 3 }: BarChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const max = Math.max(1, ...bars.map((bar) => bar.value))
  const rects = barGeometry(bars.map((bar) => bar.value), width, height, gap, max)

  return (
    <figure className="m-0">
      {/* The top of the scale goes above the bars, so it never lies over one. */}
      <p aria-hidden="true" className="mb-1 text-right text-caption tabular-nums text-text-3">
        máx. {max}
      </p>
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 ? (
          <svg width={width} height={height} aria-hidden="true" className="block overflow-visible">
            <line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke="currentColor" className="text-border" strokeWidth={1} />
            {rects.map((rect, index) => {
              const bar = bars[index]
              if (!bar || rect.height === 0) return null
              return (
                <rect key={bar.key} x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={Math.min(3, rect.width / 2)} fill="currentColor" className={bar.strong ? 'text-accent' : tone}>
                  <title>{`${bar.label}: ${valueLabel(bar.value)}`}</title>
                </rect>
              )
            })}
          </svg>
        ) : null}
      </div>
      <div aria-hidden="true" className="relative mt-1.5 h-4 text-caption text-text-3">
        {ticks.map((tick) => {
          const { at, align } = tickPlacement(tick.index, bars.length)
          return (
            <span key={tick.index} className={`absolute whitespace-nowrap ${ALIGN[align]}`} style={align === 'center' ? { left: `${at * 100}%` } : undefined}>
              {tick.text}
            </span>
          )
        })}
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      {/* The table is wrapped: a table does not honour the clipping of `sr-only` itself and would widen the page. */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{columns[0]}</th>
              <th scope="col">{columns[1]}</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.key}>
                <th scope="row">{bar.label}</th>
                <td>{valueLabel(bar.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

interface RingProps {
  /** 0 to 1, or null before there is any data. */
  value: number | null
  tone: string
  /** What is written in the middle. */
  children: ReactNode
  size?: number
  stroke?: number
}

/** A ring that fills as far as `value`, with something written in the middle. */
export function Ring({ value, tone, children, size = 104, stroke = 10 }: RingProps) {
  const radius = (size - stroke) / 2
  const { dash, gap } = ringDash(value ?? 0, radius)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-surface-2" />
        {value !== null && value > 0 ? (
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${dash} ${gap}`} className={tone} />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[24px] font-semibold tabular-nums">{children}</div>
    </div>
  )
}

export interface Segment {
  key: string
  value: number
  /** Background colour class of the segment and its dot in the legend. */
  tone: string
  label: string
}

/** A bar split in proportion to the segments, with a legend that carries the names and the numbers (the colour is never the only clue). */
export function SegmentBar({ segments }: { segments: readonly Segment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  return (
    <div>
      <div aria-hidden="true" className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-2">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span key={segment.key} className={segment.tone} style={{ width: `${(segment.value / total) * 100}%` }} />
          ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2 text-secondary">
            <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${segment.tone}`} />
            <span className="min-w-0 flex-1 text-text-2">{segment.label}</span>
            <span className="font-medium tabular-nums">{segment.value}</span>
            <span className="w-10 text-right text-text-3 tabular-nums">{total > 0 ? `${Math.round((segment.value / total) * 100)} %` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
