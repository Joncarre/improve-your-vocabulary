import type { ButtonHTMLAttributes } from 'react'
import { buttonClass, type ButtonVariant, ICON_BUTTON_CLASS } from './classes.ts'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name (the button only shows an icon). */
  label: string
}

export function IconButton({ label, className = '', ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`${ICON_BUTTON_CLASS} ${className}`.trim()}
      {...props}
    />
  )
}
