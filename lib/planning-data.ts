import { prisma } from '@/lib/prisma'
import { attendanceActor } from '@/lib/attendance/access'
import { addDateDays, dateKey, parseDate, todayInMexico } from './attendance/dates'
import { planningMonth, type PlanningEvent } from './planning'

export async function getPlanningData(requestedMonth?: string) {
  const actor = await attendanceActor()
  const people = await prisma.user.findMany({ where: { bossId: actor.id, id: { not: actor.id }, isBlacklisted: false }, select: { id: true, name: true, employeeNumber: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] })
  if (!people.length) return null
  const today = todayInMexico(), calendar = planningMonth(requestedMonth, today)
  const ids = people.map(person => person.id), byId = new Map(people.map(person => [person.id, person]))
  const [requests, leaves, absences, holidays] = await Promise.all([
    prisma.request.findMany({ where: { userId: { in: ids }, status: { in: ['PENDING_BOSS', 'PENDING_HR', 'APPROVED', 'CANCELLATION_REQUESTED'] },
      startDate: { lt: parseDate(addDateDays(calendar.end, 1)) }, OR: [{ returnDate: { gte: parseDate(calendar.start) } }, { endDate: { gte: parseDate(calendar.start) } }, { startDate: { gte: parseDate(calendar.start) } }],
    }, select: { id: true, userId: true, type: true, status: true, approvedByBoss: true, startDate: true, returnDate: true, endDate: true, permitTime: true }, orderBy: { startDate: 'asc' } }),
    // Only dates are exposed to the leader: no medical notes, diagnosis, series or folio.
    prisma.medicalLeave.findMany({ where: { userId: { in: ids }, cancelledAt: null, startDate: { lte: parseDate(calendar.end) }, endDate: { gte: parseDate(calendar.start) } }, select: { id: true, userId: true, startDate: true, endDate: true } }),
    prisma.attendanceDay.findMany({ where: { userId: { in: ids }, isWorkday: true, date: { gte: parseDate(calendar.start), lte: parseDate(calendar.end) }, decision: 'ABSENCE', reviewStatus: 'RESOLVED', batch: { needsRefresh: false, status: { in: ['PUBLISHED', 'CLOSED'] } } }, select: { userId: true, date: true }, orderBy: { date: 'asc' } }),
    prisma.holiday.findMany({ where: { date: { gte: parseDate(calendar.start), lt: parseDate(addDateDays(calendar.end, 1)) } }, select: { date: true, name: true } }),
  ])
  const events: PlanningEvent[] = []
  const labels: Record<string, string> = { VACATION: 'Vacaciones', PERMIT_HOME_OFFICE: 'Home Office', PERMIT_ABSENCE: 'Permiso de ausencia', PERMIT_BIRTHDAY: 'Permiso de cumpleaños', PERMIT_LATE: 'Permiso de llegada tarde', PERMIT_EARLY: 'Permiso de salida anticipada', PERMIT_OTHER: 'Permiso especial' }
  for (const request of requests) {
    if (request.status !== 'PENDING_BOSS' && !request.approvedByBoss) continue
    const person = byId.get(request.userId)!
    const start = dateKey(request.startDate), end = request.type === 'VACATION' && request.returnDate ? addDateDays(dateKey(request.returnDate), -1) : dateKey(request.endDate || request.startDate)
    if (end < start || end < calendar.start || start > calendar.end) continue
    events.push({ id: 'request-' + request.id, userId: person.id, name: person.name, employeeNumber: person.employeeNumber,
      category: request.type === 'VACATION' ? 'VACATION' : request.type === 'PERMIT_HOME_OFFICE' ? 'HOME_OFFICE' : 'PERMIT',
      label: labels[request.type] || 'Permiso', start, end, pending: request.status === 'PENDING_BOSS',
      status: request.status === 'PENDING_BOSS' ? 'Pendiente de aprobación del jefe' : request.status === 'CANCELLATION_REQUESTED' ? 'Cancelación solicitada · continúa vigente' : request.status === 'PENDING_HR' ? 'Aprobada por el jefe · RH pendiente' : 'Aprobada',
      ...(request.type === 'VACATION' && request.returnDate ? { returnDate: dateKey(request.returnDate) } : {}), time: request.permitTime,
    })
  }
  for (const leave of leaves) {
    const person = byId.get(leave.userId)!
    events.push({ id: 'medical-' + leave.id, userId: person.id, name: person.name, employeeNumber: person.employeeNumber, category: 'MEDICAL', label: 'Incapacidad', start: dateKey(leave.startDate), end: dateKey(leave.endDate), pending: false, status: 'Registrada por RH / Administración' })
  }
  const seen = new Set<string>()
  for (const absence of absences) {
    const person = byId.get(absence.userId)!, day = dateKey(absence.date), id = 'absence-' + person.id + '-' + day
    if (seen.has(id)) continue
    seen.add(id)
    events.push({ id, userId: person.id, name: person.name, employeeNumber: person.employeeNumber, category: 'ABSENCE', label: 'Falta confirmada', start: day, end: day, pending: false, status: 'Dictamen resuelto' })
  }
  return { calendar, today, people, events, holidays: holidays.map(h => ({ date: dateKey(h.date), name: h.name })) }
}
