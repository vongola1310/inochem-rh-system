// lib/team-vacations.ts
// ============================================================
// Resumen de vacaciones de los subordinados DIRECTOS de un jefe.
// Solo para uso en el servidor (usa Prisma).
// Devuelve únicamente campos seguros (nunca password, email, etc.).
// ============================================================
import { prisma } from '@/lib/prisma'
import { getCycleBounds } from '@/lib/vacation-cycle'
import { getDaysByYears } from '@/lib/lft-law'

const DAY_MS = 86_400_000

export type TeamMemberVacation = {
  id: string
  name: string
  jobTitle: string | null
  employeeNumber: string
  entryDate: Date
  yearsWorked: number
  // Periodo vigente
  cycleStart: Date
  cycleEnd: Date
  daysToAnniversary: number
  totalDays: number      // Lo que le toca en el periodo actual (saldo registrado)
  legalDays: number      // Lo que marca la tabla LFT + bono por su antigüedad
  usedDays: number
  pendingDays: number
  pendingHRDays: number
  availableDays: number
  // Próximo periodo
  nextYearsWorked: number
  nextPeriodDays: number
  nextPeriodRequested: number
  nextPeriodAvailable: number
}

export async function getTeamVacationSummaries(bossId: string): Promise<TeamMemberVacation[]> {
  const members = await prisma.user.findMany({
    where: { bossId },
    select: {
      id: true,
      name: true,
      jobTitle: true,
      employeeNumber: true,
      entryDate: true,
      balance: { select: { totalDays: true, usedDays: true, pendingDays: true } },
    },
    orderBy: { name: 'asc' },
  })

  if (members.length === 0) return []

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // Vacaciones de los ciclos actuales y siguientes en una sola consulta.
  const futureRequests = await prisma.request.findMany({
    where: {
      userId: { in: members.map((m) => m.id) },
      type: 'VACATION',
      status: { in: ['APPROVED', 'PENDING_BOSS', 'PENDING_HR', 'CANCELLATION_REQUESTED'] },
      startDate: { gte: new Date(Math.min(...members.map(m => getCycleBounds(m.entryDate).cycleStart.getTime()))) },
    },
    select: { userId: true, startDate: true, daysRequested: true, status: true },
  })

  return members.map((m) => {
    const entryDate = new Date(m.entryDate)
    const { cycleStart, cycleEnd } = getCycleBounds(entryDate)
    const nextCycleEnd = new Date(Date.UTC(
      cycleEnd.getUTCFullYear() + 1,
      cycleEnd.getUTCMonth(),
      cycleEnd.getUTCDate()
    ))

    const yearsWorked = Math.max(0, cycleStart.getUTCFullYear() - entryDate.getUTCFullYear())
    const nextYearsWorked = yearsWorked + 1

    const totalDays = m.balance?.totalDays ?? 0
    const usedDays = m.balance?.usedDays ?? 0
    const pendingDays = m.balance?.pendingDays ?? 0
    const pendingHRDays = futureRequests
      .filter(r => r.userId === m.id && r.status === 'PENDING_HR' && r.startDate >= cycleStart && r.startDate < cycleEnd)
      .reduce((sum, r) => sum + r.daysRequested, 0)

    const nextPeriodDays = getDaysByYears(nextYearsWorked)
    const nextPeriodRequested = futureRequests
      .filter((r) => r.userId === m.id && r.startDate >= cycleEnd && r.startDate < nextCycleEnd)
      .reduce((sum, r) => sum + r.daysRequested, 0)

    return {
      id: m.id,
      name: m.name,
      jobTitle: m.jobTitle,
      employeeNumber: m.employeeNumber,
      entryDate,
      yearsWorked,
      cycleStart,
      cycleEnd,
      daysToAnniversary: Math.round((cycleEnd.getTime() - today.getTime()) / DAY_MS),
      totalDays,
      legalDays: getDaysByYears(yearsWorked),
      usedDays,
      pendingDays,
      pendingHRDays,
      availableDays: totalDays - usedDays - pendingDays,
      nextYearsWorked,
      nextPeriodDays,
      nextPeriodRequested,
      nextPeriodAvailable: nextPeriodDays - nextPeriodRequested,
    }
  })
}
