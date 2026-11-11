import { dateKey, datesBetween, isWorkday, timeSeconds } from '@/lib/attendance/dates'
import type { FieldDay, FieldEmployee, FieldMapping, FieldPreview, FieldSource } from './types'
import { resolveWorkday, type Workday } from '@/lib/attendance/workday'

export const normalizedFieldName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().split(/\s+/).sort().join(' ')
export function suggestFieldMappings(source: FieldSource, employees: FieldEmployee[]): FieldMapping {
  const result: FieldMapping = Object.create(null)
  for (const owner of new Set(source.records.map(row => row.owner).filter(Boolean))) {
    const matches = employees.filter(employee => !employee.isBlacklisted && normalizedFieldName(employee.name) === normalizedFieldName(owner))
    if (matches.length === 1) result[owner] = { userId: matches[0].id, reason: 'Coincidencia exacta de nombre completo; pendiente de confirmar por el responsable.' }
  }
  return result
}

export function buildFieldPreview({ source, mappings, employees, start, end, holidays, today, workdayFor }: {
  source: FieldSource; mappings: FieldMapping; employees: FieldEmployee[]; start: string; end: string; holidays: string[]; today: string; workdayFor?: (userId: string, date: string) => Workday
}): FieldPreview {
  datesBetween(start, end)
  const errors: string[] = [], omitted: FieldPreview['omitted'] = [], days = new Map<string, FieldDay>(), holidaysSet = new Set(holidays)
  const owners = [...new Set(source.records.map(row => row.owner).filter(Boolean))].sort()
  for (const row of source.records) {
    const omit = (reason: string) => omitted.push({ row: row.row, appointment: row.appointment, reason })
    if (row.issues.length || !row.start || !row.end) { omit(row.issues.join(' · ') || 'Faltan horarios'); continue }
    if (row.end <= row.start) { omit('El intervalo debe tener duración positiva'); continue }
    if (dateKey(row.end) >= today) { omit('Servicio con finalización hoy o en el futuro; requiere un periodo terminado'); continue }
    const first = dateKey(row.start) > start ? dateKey(row.start) : start, last = dateKey(row.end) < end ? dateKey(row.end) : end
    if (first > last) { omit('Fuera del periodo seleccionado'); continue }
    const mapping = Object.hasOwn(mappings, row.owner) ? mappings[row.owner] : undefined
    if (!mapping || (!mapping.userId && !mapping.reason.trim())) { errors.push(`Vincula o excluye con motivo a ${row.owner}.`); continue }
    if (!mapping.userId) { omit(mapping.reason); continue }
    const employee = employees.find(employee => employee.id === mapping.userId)
    if (!employee) { errors.push(`El colaborador vinculado a ${row.owner} ya no existe.`); continue }
    if (employee.isBlacklisted) { omit('Colaborador en lista negra'); continue }
    let covered = false
    for (const date of datesBetween(first, last)) {
      const workday = workdayFor?.(employee.id, date) || resolveWorkday(date)
      if (workday.ambiguous && isWorkday(date, holidaysSet)) { errors.push(`Asigna la sede de ${employee.name} para aplicar su jornada del ${date}.`); continue }
      const entrySeconds = date === dateKey(row.start) ? timeSeconds(row.start.slice(11))! : 0
      const exitSeconds = date === dateKey(row.end) ? timeSeconds(row.end.slice(11))! : 86400
      if (exitSeconds === 0) continue
      const singleDay = dateKey(row.start) === dateKey(row.end)
      const reportedHours = singleDay ? row.workingHours ?? row.netHours : null
      if (reportedHours !== null && (reportedHours < 0 || reportedHours > 24)) { errors.push(`Revisa las horas de la cita ${row.appointment}: deben estar entre 0 y 24.`); continue }
      const from = Math.max(entrySeconds, workday.startSeconds), to = Math.min(exitSeconds, workday.endSeconds)
      const workedSeconds = reportedHours !== null ? Math.round(reportedHours * 3600) : Math.max(0, to - from)
      const service = { appointment: row.appointment, account: row.account, workType: row.workType, row: row.row,
        startSeconds: singleDay ? entrySeconds : from, endSeconds: singleDay ? exitSeconds : Math.max(from, to), workedSeconds,
        reportedHours, method: reportedHours === null ? 'INTERVAL' as const : 'REPORTED' as const }
      const key = `${employee.id}|${date}`, before = days.get(key)
      days.set(key, { userId: employee.id, date, appointments: [...new Set([...(before?.appointments || []), row.appointment])].sort(), rows: [...(before?.rows || []), row.row],
        entrySeconds: Math.min(before?.entrySeconds ?? service.startSeconds, service.startSeconds),
        exitSeconds: Math.max(before?.exitSeconds ?? service.endSeconds, service.endSeconds),
        services: [...(before?.services || []), service],
      })
      if (isWorkday(date, holidaysSet) && date >= dateKey(employee.entryDate)) covered = true
    }
    if (!covered) omit('Sin días laborales aplicables en el periodo')
  }
  const coverageDays = [...days.values()].sort((a, b) => a.date.localeCompare(b.date) || a.userId.localeCompare(b.userId))
  const workingDays = coverageDays.filter(day => isWorkday(day.date, holidaysSet) && day.date >= dateKey(employees.find(employee => employee.id === day.userId)!.entryDate))
  return { days: workingDays, coverageDays, errors: [...new Set(errors)], omitted, owners }
}
