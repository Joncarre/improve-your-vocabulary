import { ChevronDown, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconButton } from '../../ui/Button.tsx'

export const INPUT =
  'h-10 w-full min-w-0 rounded-control border border-border bg-surface-2 px-3 text-text placeholder:text-text-3'
export const TEXTAREA = `${INPUT} h-auto resize-none py-2 leading-snug`

/** A labelled field. The control goes inside the label, so tapping the text focuses it. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-caption text-text-2">{label}</span>
      {children}
    </label>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  lang,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** `en` switches off Spanish autocorrect for English text. */
  lang?: 'en' | 'es'
}) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        lang={lang}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className={INPUT}
      />
    </Field>
  )
}

export function AreaField({
  label,
  value,
  onChange,
  rows = 2,
  lang,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  lang?: 'en' | 'es'
}) {
  return (
    <Field label={label}>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        lang={lang}
        spellCheck={false}
        className={TEXTAREA}
      />
    </Field>
  )
}

export function SelectInput<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <Field label={label}>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          className={`${INPUT} appearance-none pr-9`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-3 text-text-3" aria-hidden="true" />
      </span>
    </Field>
  )
}

/** A block of the editor (one sense, one family member…) with a delete button. */
export function EditorCard({ title, onRemove, children }: { title: string; onRemove?: () => void; children: ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-bg/40 p-3">
      <div className="-mt-1 mb-1 flex items-center justify-between">
        <h4 className="text-secondary font-medium text-text-2">{title}</h4>
        {onRemove ? (
          <IconButton label={`Quitar: ${title}`} onClick={onRemove} className="-mr-2">
            <Trash2 size={16} aria-hidden="true" />
          </IconButton>
        ) : null}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

export function EditorGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mt-5 min-w-0">
      <legend className="mb-2 text-section font-semibold">{title}</legend>
      <div className="space-y-2">{children}</div>
    </fieldset>
  )
}
