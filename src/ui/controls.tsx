import { Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { ICON_BUTTON_CLASS } from './classes.ts'

export function SettingsSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-1.5 px-1 text-caption font-medium uppercase tracking-wider text-text-3">{title}</h2>
      <div className="divide-y divide-border rounded-card border border-border bg-surface">{children}</div>
      {note ? <p className="mt-1.5 px-1 text-caption text-text-3">{note}</p> : null}
    </section>
  )
}

export function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-3 py-1.5">
      <div className="min-w-0">
        <div className="text-body">{label}</div>
        {description ? <div className="text-secondary text-text-3">{description}</div> : null}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    // The button is the 44 pt touch target; the visible track is smaller.
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-14 items-center justify-end"
    >
      <span
        className={`relative h-[26px] w-[44px] rounded-full border transition-colors motion-reduce:transition-none ${
          checked ? 'border-accent bg-accent' : 'border-border bg-surface-2'
        }`}
      >
        {/* Explicit left: an absolute span without it takes the button's text-align (centre) as its static position. */}
        <span
          className={`absolute left-0.5 top-0.5 size-5 rounded-full transition-transform motion-reduce:transition-none ${
            checked ? 'translate-x-[18px] bg-bg' : 'translate-x-0 bg-text-3'
          }`}
        />
      </span>
    </button>
  )
}

export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (next: number) => void
  label: string
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div role="group" aria-label={label} className="flex items-center">
      <button
        type="button"
        aria-label={`Menos: ${label}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className={`${ICON_BUTTON_CLASS} disabled:opacity-30`}
      >
        <Minus size={18} aria-hidden="true" />
      </button>
      <output className="w-9 text-center tabular-nums">{value}</output>
      <button
        type="button"
        aria-label={`Más: ${label}`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className={`${ICON_BUTTON_CLASS} disabled:opacity-30`}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

export function RangeField({
  value,
  min,
  max,
  step,
  onChange,
  format,
  label,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (next: number) => void
  format: (value: number) => string
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-28 accent-accent"
      />
      <output className="w-12 text-right tabular-nums text-text-2">{format(value)}</output>
    </div>
  )
}

export function SelectField({
  value,
  options,
  onChange,
  label,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (next: string) => void
  label: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 max-w-[min(18rem,52vw)] rounded-control border border-border bg-surface-2 px-3 text-text"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
