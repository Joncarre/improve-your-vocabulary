export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const BASE =
  'inline-flex h-10 items-center justify-center gap-2 rounded-control px-4 text-body transition-colors disabled:opacity-40'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent font-semibold text-bg active:opacity-80',
  secondary: 'border border-border bg-surface-2 text-text active:bg-surface',
  ghost: 'text-text-2 active:bg-surface-2',
}

/** Class list for anything that should look like a button (also usable on router links). */
export function buttonClass(variant: ButtonVariant = 'secondary', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim()
}

/** 44 x 44 touch target around a small icon. */
export const ICON_BUTTON_CLASS =
  'inline-flex size-11 items-center justify-center rounded-full text-text-2 transition-colors active:bg-surface-2'
