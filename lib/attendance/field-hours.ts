import type { FieldService, FieldWorkEvidence, Punch } from './types'
import type { Workday } from './workday'

export function fieldHours(rows: FieldWorkEvidence[]) {
  const services = new Map<string, FieldService>()
  let conflict = false
  for (const row of rows) {
    if (!row.services) conflict = true
    for (const service of row.services || []) {
      const key = service.appointment.trim().toUpperCase(), before = services.get(key)
      if (before && (before.startSeconds !== service.startSeconds || before.endSeconds !== service.endSeconds || before.workedSeconds !== service.workedSeconds || before.account !== service.account)) conflict = true
      if (!before) services.set(key, service)
    }
  }
  return { services: [...services.values()], seconds: [...services.values()].reduce((sum, service) => sum + service.workedSeconds, 0), conflict }
}

export function durationLabel(seconds: number) {
  const minutes = Math.round(seconds / 60)
  return Math.floor(minutes / 60) + ' h ' + String(minutes % 60).padStart(2, '0') + ' min'
}

export type WorkSummary = { fieldSeconds: number; officeSeconds: number; workedSeconds: number; officeIntervals: { startSeconds: number; endSeconds: number }[]; uncertainOffice: boolean; fieldConflict: boolean }
export function workedTime(rows: FieldWorkEvidence[], punches: Punch[], workday: Workday): WorkSummary {
  const field = fieldHours(rows), times = [...new Set(punches.map(punch => punch.seconds))].sort((a, b) => a - b)
  const officeIntervals: WorkSummary['officeIntervals'] = []
  const uncertainOffice = times.length > 2 && times.length % 2 !== 0
  // Con una cantidad impar no se atribuye presencia a tramos sin pareja.
  if (!uncertainOffice) for (let index = 0; index + 1 < times.length; index += 2) {
    let segments = [{ startSeconds: Math.max(workday.startSeconds, times[index]), endSeconds: Math.min(workday.endSeconds, times[index + 1]) }].filter(segment => segment.endSeconds > segment.startSeconds)
    for (const service of field.services) segments = segments.flatMap(segment => {
      if (service.endSeconds <= segment.startSeconds || service.startSeconds >= segment.endSeconds) return [segment]
      return [{ startSeconds: segment.startSeconds, endSeconds: Math.min(segment.endSeconds, service.startSeconds) }, { startSeconds: Math.max(segment.startSeconds, service.endSeconds), endSeconds: segment.endSeconds }].filter(item => item.endSeconds > item.startSeconds)
    })
    officeIntervals.push(...segments)
  }
  const officeSeconds = officeIntervals.reduce((sum, interval) => sum + interval.endSeconds - interval.startSeconds, 0)
  const fieldConflict = field.conflict || field.services.some((a, index) => field.services.slice(index + 1).some(b => a.workedSeconds > 0 && b.workedSeconds > 0 && Math.max(a.startSeconds, b.startSeconds) < Math.min(a.endSeconds, b.endSeconds)))
  return { fieldSeconds: field.seconds, officeSeconds, workedSeconds: field.seconds + officeSeconds, officeIntervals, uncertainOffice, fieldConflict }
}
