import { prisma } from '@/lib/prisma'
import { addDateDays, dateKey, displayDate, parseDate, todayInMexico } from '@/lib/attendance/dates'
import { WhoIsOutTabs, type AbsentPerson } from './who-is-out-client'

export async function WhoIsOutCard() {
  const today = todayInMexico(), through = addDateDays(today, 15)
  const [requests, leaves, absences] = await Promise.all([
    prisma.request.findMany({ where: { approvedByBoss: true, status: { in: ['APPROVED', 'PENDING_HR', 'CANCELLATION_REQUESTED'] },
      startDate: { lt: parseDate(addDateDays(through, 1)) }, OR: [{ returnDate: { gte: parseDate(today) } }, { endDate: { gte: parseDate(today) } }, { startDate: { gte: parseDate(today) } }],
    }, select: { id: true, type: true, startDate: true, returnDate: true, endDate: true, userId: true, user: { select: { name: true, jobTitle: true } } }, orderBy: { startDate: 'asc' } }),
    prisma.medicalLeave.findMany({ where: { cancelledAt: null, startDate: { lte: parseDate(through) }, endDate: { gte: parseDate(today) } },
      select: { id: true, userId: true, startDate: true, endDate: true, user: { select: { name: true, jobTitle: true } } } }),
    prisma.attendanceDay.findMany({ where: { isWorkday: true, date: { gte: parseDate(today), lte: parseDate(through) }, decision: 'ABSENCE', reviewStatus: 'RESOLVED', batch: { needsRefresh: false } },
      select: { id: true, userId: true, date: true, user: { select: { name: true, jobTitle: true } } } }),
  ])
  const labels: Record<string, string> = { VACATION: 'Vacaciones', PERMIT_HOME_OFFICE: 'Home Office', PERMIT_ABSENCE: 'Ausencia autorizada', PERMIT_BIRTHDAY: 'Ausencia autorizada', PERMIT_LATE: 'Permiso de llegada', PERMIT_EARLY: 'Permiso de salida', PERMIT_OTHER: 'Permiso autorizado' }
  const items = [
    ...requests.map(row => ({ userId: row.userId, user: row.user, start: dateKey(row.startDate), end: row.type === 'VACATION' && row.returnDate ? addDateDays(dateKey(row.returnDate), -1) : dateKey(row.endDate || row.startDate), category: row.type === 'VACATION' ? 'VACATION' as const : 'ABSENCE' as const, label: labels[row.type] || 'Permiso autorizado' })),
    ...leaves.map(row => ({ userId: row.userId, user: row.user, start: dateKey(row.startDate), end: dateKey(row.endDate), category: 'ABSENCE' as const, label: 'Ausencia autorizada' })),
    ...absences.map(row => ({ userId: row.userId, user: row.user, start: dateKey(row.date), end: dateKey(row.date), category: 'ABSENCE' as const, label: 'Ausente' })),
  ].filter(row => row.end >= today && row.start <= through).sort((a, b) => a.start.localeCompare(b.start))
  function people(upcoming: boolean): AbsentPerson[] {
    const grouped = new Map<string, AbsentPerson>()
    for (const row of items.filter(row => upcoming ? row.start > today : row.start <= today && row.end >= today)) {
      const key = upcoming ? `${row.userId}-${row.start}` : row.userId
      const previous = grouped.get(key)
      if (previous) {
        if (!previous.labels.includes(row.label)) previous.labels.push(row.label)
        if (row.category === 'VACATION') previous.category = 'VACATION'
      } else grouped.set(key, { id: key, name: row.user.name, jobTitle: row.user.jobTitle || 'Colaborador', initial: row.user.name.charAt(0).toUpperCase(),
        startDate: displayDate(row.start), endDate: displayDate(row.end), category: row.category, labels: [row.label] })
    }
    return [...grouped.values()]
  }
  return <WhoIsOutTabs currentOut={people(false)} upcomingOut={people(true)} />
}
