import { businessLocalMidnightToUtc, getBusinessCalendarWindow } from './business-time'

describe('Dashboard business timezone window', () => {
  it('uses Asuncion local dates around midnight instead of the host timezone', () => {
    const window = getBusinessCalendarWindow(new Date('2026-11-13T02:30:00.000Z'))

    expect(window.today).toBe('2026-11-12')
    expect(window.startOfToday.toISOString()).toBe('2026-11-12T03:00:00.000Z')
    expect(window.startOfTomorrow.toISOString()).toBe('2026-11-13T03:00:00.000Z')
    expect(window.days).toHaveLength(7)
    expect(window.days[6].date).toBe(window.today)
  })

  it('uses the local month boundary and excludes future calendar days', () => {
    const window = getBusinessCalendarWindow(new Date('2026-11-01T02:30:00.000Z'))

    expect(window.today).toBe('2026-10-31')
    expect(window.monthStart).toBe('2026-10-01')
    expect(window.startOfMonth.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(window.days.at(-1)?.date).toBe('2026-10-31')
    expect(window.days.some(({ date }) => date > window.today)).toBe(false)
  })

  it('converts an Asuncion month start with IANA timezone rules', () => {
    expect(businessLocalMidnightToUtc('2026-11-01').toISOString()).toBe('2026-11-01T03:00:00.000Z')
  })
})
