import { BookOpen, ChartNoAxesColumn, Gamepad2, House, Plus, Settings, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Match the path exactly (needed for "/" so it is not active everywhere). */
  end?: boolean
}

/** The four destinations around the central "+" button. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Hoy', icon: House, end: true },
  { to: '/vocabulary', label: 'Vocabulario', icon: BookOpen },
  { to: '/games', label: 'Juegos', icon: Gamepad2 },
  { to: '/progress', label: 'Progreso', icon: ChartNoAxesColumn },
]

export const ADD_ITEM: NavItem = { to: '/add', label: 'Añadir', icon: Plus }
export const SETTINGS_ITEM: NavItem = { to: '/settings', label: 'Ajustes', icon: Settings }
