import { addDateDays, dateKey, parseDate, todayInMexico } from './attendance/dates'

export const PLANNING_TYPES = {
  VACATION: { label: 'Vacaciones', color: 'border-green-700 bg-green-100 text-green-950', dot: 'bg-green-700' },
  PERMIT: { label: 'Permisos', color: 'border-blue-700 bg-blue-100 text-blue-950', dot: 'bg-blue-700' },
  HOME_OFFICE: { label: 'Home Office', color: 'border-teal-700 bg-teal-100 text-teal-950', dot: 'bg-teal-700' },
  MEDICAL: { label: 'Incapacidades', color: 'border-purple-700 bg-purple-100 text-purple-950', dot: 'bg-purple-700' },
  ABSENCE: { label: 'Faltas confirmadas', color: 'border-red-700 bg-red-100 text-red-950', dot: 'bg-red-700' },
} as const
export type PlanningEvent = {
  id: string; userId: string; name: string; employeeNumber: string
  category: keyof typeof PLANNING_TYPES; label: string; start: string; end: string
  pending: boolean; status: string; returnDate?: string; time?: string | null
}

export function planningMonth(value?: string, today = todayInMexico()) {
  const valid = value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1901 && Number(value.slice(0, 4)) <= 2199
  const month = valid ? value! : today.slice(0, 7)
  const first = parseDate(month + '-01'), day = first.getUTCDay()
  const start = addDateDays(dateKey(first), -(day === 0 ? 6 : day - 1))
  const days = Array.from({ length: 42 }, (_, i) => addDateDays(start, i))
  const adjacent = (delta: number) => {
    const target = dateKey(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1))).slice(0, 7)
    return target < '1901-01' || target > '2199-12' ? month : target
  }
  return { month, start, end: days[41], days, previous: adjacent(-1), next: adjacent(1) }
}

/** Split multi-day bars at week boundaries and assign non-overlapping display lanes. */
export function planningWeek(events: PlanningEvent[], start: string) {
  const end = addDateDays(start, 6)
  const segments = events.filter(event => event.start <= end && event.end >= start && event.start <= event.end).map(event => {
    const from = event.start > start ? event.start : start, through = event.end < end ? event.end : end
    const column = (parseDate(from).getTime() - parseDate(start).getTime()) / 86400000
    const span = (parseDate(through).getTime() - parseDate(from).getTime()) / 86400000 + 1
    return { event, column, span, continuesBefore: event.start < start, continuesAfter: event.end > end }
  }).sort((a, b) => a.column - b.column || b.span - a.span || a.event.name.localeCompare(b.event.name, 'es') || a.event.id.localeCompare(b.event.id))
  const laneEnds: number[] = []
  const bars = segments.map(segment => {
    let lane = laneEnds.findIndex(last => last < segment.column)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = segment.column + segment.span - 1
    return { ...segment, lane }
  })
  return { bars, lanes: laneEnds.length }
}
