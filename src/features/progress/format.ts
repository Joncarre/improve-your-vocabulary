import { dayKeyDate } from '../../srs/studyDay.ts'

const dayMonth = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
const longDay = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

/** Intl abbreviates with a full stop in some browsers ("sept.") and not in others: always without. */
const clean = (text: string) => text.replace(/\./g, '')

/** "28 oct". */
export const formatDayMonth = (key: string) => clean(dayMonth.format(dayKeyDate(key)))

/** "martes 28 de octubre": for what a screen reader says. */
export const formatLongDay = (key: string) => longDay.format(dayKeyDate(key))

/** "Hoy", "Mañana" and then the day of the week ("mié"): the names of the days of the forecast. */
export function forecastLabel(key: string, index: number): string {
  if (index === 0) return 'Hoy'
  if (index === 1) return 'Mañana'
  return clean(weekday.format(dayKeyDate(key)))
}

/** "1 repaso", "20 repasos". */
export const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
