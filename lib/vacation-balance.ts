import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { getCycleBounds } from './vacation-cycle'
import { getDaysByYears } from './lft-law'
import { calculateVacationUsage } from './vacation-usage'

/** Reintenta únicamente conflictos de concurrencia; la transacción anterior ya se revirtió. */
export async function withBalanceTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error
    }
  }
}

export async function getCycleUsage(tx: Prisma.TransactionClient, userId: string, entryDate: Date, asOf = new Date()) {
  const { cycleStart, cycleEnd } = getCycleBounds(entryDate, asOf)
  const requests = await tx.request.findMany({
    where: { userId, type: 'VACATION', startDate: { gte: cycleStart, lt: cycleEnd } },
    select: { startDate: true, daysRequested: true, status: true },
  })
  return calculateVacationUsage(requests, cycleStart, cycleEnd)
}

/** Renueva solo al cambiar de ciclo. Conserva ajustes manuales del ciclo ya inicializado. */
export async function renewBalanceInTransaction(tx: Prisma.TransactionClient, userId: string, entryDate: Date, asOf = new Date()) {
  const balance = await tx.vacationBalance.findUnique({ where: { userId } })
  if (!balance) return false
  const { cycleStart } = getCycleBounds(entryDate, asOf)
  const yearsCompleted = cycleStart.getUTCFullYear() - entryDate.getUTCFullYear()
  if (yearsCompleted < 1 || yearsCompleted <= balance.lastYearProcessed) return false
  const { usedDays, pendingDays } = await getCycleUsage(tx, userId, entryDate, asOf)
  await tx.vacationBalance.update({
    where: { userId },
    data: { totalDays: getDaysByYears(yearsCompleted), usedDays, pendingDays, lastYearProcessed: yearsCompleted, lastUpdated: asOf },
  })
  return true
}
