/*
 * The study day runs from `dayStartHour` (04:00 by default) to the same hour the next day, in the
 * device's local time, so a late-night session still belongs to "today". Boundaries are built from
 * calendar dates, not by adding 24 h, so they stay right on the days the clocks change.
 */

function localAt(year: number, month: number, day: number, hour: number): number {
  return new Date(year, month, day, hour, 0, 0, 0).getTime()
}

/** The instant the current study day began. */
export function studyDayStart(now: number, dayStartHour: number): number {
  const date = new Date(now)
  const todayStart = localAt(date.getFullYear(), date.getMonth(), date.getDate(), dayStartHour)
  return todayStart <= now ? todayStart : localAt(date.getFullYear(), date.getMonth(), date.getDate() - 1, dayStartHour)
}

/** The instant the next study day begins (the end of the current one). */
export function studyDayEnd(now: number, dayStartHour: number): number {
  const start = new Date(studyDayStart(now, dayStartHour))
  return localAt(start.getFullYear(), start.getMonth(), start.getDate() + 1, dayStartHour)
}

function keyOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "2026-10-28": the calendar date on which the study day started. */
export function studyDayKey(now: number, dayStartHour: number): string {
  return keyOf(new Date(studyDayStart(now, dayStartHour)))
}

/** The key of the day before `key` ("2026-03-01" -> "2026-02-28"), by calendar and not by clock arithmetic. */
export function previousDayKey(key: string): string {
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number)
  return keyOf(new Date(year, month - 1, day - 1))
}
