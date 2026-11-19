import { addDateDays, dateKey, isWorkday, parseDate, todayInMexico } from './attendance/dates'

/** Calendar widgets use local dates; persisted business dates use UTC date-only keys. */
export function calendarDate(key: string): Date {
  const date = parseDate(key)
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12)
}

export function calendarKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function vacationBreakdown(start: string, end: string, holidays: Set<string>, birthDate?: Date | string | null) {
  parseDate(start)
  parseDate(end)
  const result = { total: 0, weekends: 0, holidays: 0, birthday: 0, business: 0 }
  const birthday = birthDate ? dateKey(birthDate).slice(5) : null
  // The return day is never charged as vacation.
  for (let key = start; key < end; key = addDateDays(key, 1)) {
    result.total++
    const weekday = parseDate(key).getUTCDay()
    if (weekday === 0 || weekday === 6) result.weekends++
    else if (holidays.has(key)) result.holidays++
    else if (key.slice(5) === birthday) result.birthday++
    else result.business++
  }
  return result
}

export function birthdayPermission(birthDate: Date | string | null | undefined, holidays: Set<string>, now = new Date()) {
  if (!birthDate) return { key: undefined, error: 'No tienes fecha de nacimiento registrada. Contacta a RH.' }
  const key = todayInMexico(now).slice(0, 4) + '-' + dateKey(birthDate).slice(5)
  try { parseDate(key) } catch { return { key: undefined, error: 'Tu cumpleaños no tiene una fecha válida este año. El día libre no es transferible.' } }
  return { key, error: isWorkday(key, holidays) ? null : 'Tu cumpleaños cae en fin de semana o festivo. El día libre no es transferible.' }
}

export function validateRequestDates(type: string, start: string, end: string, holidays: Set<string>, birthDate?: Date | string | null, now = new Date()): string | null {
  try { parseDate(start); parseDate(end) } catch { return 'Revisa las fechas de la solicitud.' }
  if (!isWorkday(start, holidays)) return 'La fecha de inicio debe ser un día hábil.'
  if (type === 'VACATION') {
    if (end <= start) return 'El regreso debe ser posterior al inicio de vacaciones.'
    if (!isWorkday(end, holidays)) return 'La fecha de regreso debe ser un día hábil.'
  } else if (end !== start) return 'El permiso debe corresponder a un solo día.'
  if (type === 'PERMIT_BIRTHDAY') {
    const birthday = birthdayPermission(birthDate, holidays, now)
    if (birthday.error) return birthday.error
    if (start !== birthday.key) return 'El permiso de cumpleaños debe coincidir con tu cumpleaños de este año.'
  }
  return null
}
