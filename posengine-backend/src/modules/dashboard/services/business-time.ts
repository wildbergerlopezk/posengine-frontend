export const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || 'America/Asuncion'

export interface BusinessCalendarWindow {
  asOf: Date
  today: string
  monthStart: string
  weekStart: string
  startOfToday: Date
  startOfTomorrow: Date
  startOfMonth: Date
  startOfWeek: Date
  days: Array<{ date: string; start: Date; end: Date }>
}

const dateParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  }
}

const dateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const shiftDateKey = (key: string, amount: number) => {
  const [year, month, day] = key.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + amount))
  return dateKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
}

/** Convert a local wall-clock time to its UTC instant using the IANA rules. */
export const businessLocalMidnightToUtc = (date: string, timeZone = BUSINESS_TIME_ZONE) => {
  const [year, month, day] = date.split('-').map(Number)
  const targetWallTime = Date.UTC(year, month - 1, day)
  let candidate = targetWallTime

  // Applying the observed IANA offset converges in one step for ordinary
  // midnights and still avoids relying on the host machine's local timezone.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(candidate))
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
    const displayedWallTime = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    )
    const adjustment = targetWallTime - displayedWallTime
    candidate += adjustment
    if (adjustment === 0) break
  }

  return new Date(candidate)
}

export const toUtcTimestampWithoutZone = (date: Date) =>
  date.toISOString().slice(0, 23).replace('T', ' ')

export const getBusinessCalendarWindow = (
  referenceDate = new Date(),
  timeZone = BUSINESS_TIME_ZONE,
): BusinessCalendarWindow => {
  const { year, month, day } = dateParts(referenceDate, timeZone)
  const today = dateKey(year, month, day)
  const monthStart = dateKey(year, month, 1)
  const weekStart = shiftDateKey(today, -6)
  const startOfToday = businessLocalMidnightToUtc(today, timeZone)
  const startOfTomorrow = businessLocalMidnightToUtc(shiftDateKey(today, 1), timeZone)
  const startOfMonth = businessLocalMidnightToUtc(monthStart, timeZone)
  const startOfWeek = businessLocalMidnightToUtc(weekStart, timeZone)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDateKey(weekStart, index)
    return {
      date,
      start: businessLocalMidnightToUtc(date, timeZone),
      end: businessLocalMidnightToUtc(shiftDateKey(date, 1), timeZone),
    }
  })

  return { asOf: referenceDate, today, monthStart, weekStart, startOfToday, startOfTomorrow, startOfMonth, startOfWeek, days }
}
