const DAY = 86400000

export function dateKey(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10)
}

export function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Fecha inválida. Usa año-mes-día.')
  const date = new Date(value + 'T00:00:00.000Z')
  if (!Number.isFinite(date.getTime()) || dateKey(date) !== value) throw new Error('La fecha no existe.')
  if (date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2200) throw new Error('Fecha fuera del intervalo admitido.')
  return date
}

export function addDateDays(value: string, days: number): string {
  return dateKey(new Date(parseDate(value).getTime() + days * DAY))
}

export function calendarDays(start: string, end: string): number {
  const count = (parseDate(end).getTime() - parseDate(start).getTime()) / DAY + 1
  if (count < 1) throw new Error('La fecha final debe ser igual o posterior a la inicial.')
  return count
}

export function datesBetween(start: string, end: string): string[] {
  const count = calendarDays(start, end)
  if (count > 93) throw new Error('Importa periodos de hasta 93 días.')
  return Array.from({ length: count }, (_, index) => addDateDays(start, index))
}

export function isWorkday(date: string, holidays: Set<string>): boolean {
  const weekday = parseDate(date).getUTCDay()
  return weekday !== 0 && weekday !== 6 && !holidays.has(date)
}

export function todayInMexico(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-')
}

export function timeSeconds(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i)
  if (!match) return null
  let hours = Number(match[1])
  const minutes = Number(match[2]), seconds = Number(match[3] || 0)
  if (minutes > 59 || seconds > 59 || (match[4] ? hours < 1 || hours > 12 : hours > 23)) return null
  if (match[4]) hours = hours % 12 + (match[4].toUpperCase() === 'PM' ? 12 : 0)
  return hours * 3600 + minutes * 60 + seconds
}

export function displayTime(seconds: number | null): string {
  if (seconds === null) return 'Sin registro'
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(v => String(v).padStart(2, '0')).join(':')
}

export function displayDate(value: Date | string): string {
  return dateKey(value).split('-').reverse().join('/')
}

export function businessDays(start: Date | string, end: Date | string, holidays: (Date | string)[] = []): number {
  const holidaySet = new Set(holidays.map(dateKey))
  return datesBetween(dateKey(start), dateKey(end)).filter(date => isWorkday(date, holidaySet)).length
}

export function displayWeekday(value: Date | string): string {
  return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][parseDate(dateKey(value)).getUTCDay()]
}

export function weekStart(value: Date | string): string {
  const key = dateKey(value), weekday = parseDate(key).getUTCDay()
  return addDateDays(key, -((weekday + 6) % 7))
}
