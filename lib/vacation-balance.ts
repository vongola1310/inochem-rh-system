import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { getCycleBounds } from './vacation-cycle'
import { getDaysByYears } from './lft-law'
import { calculateVacationUsage } from './vacation-usage'

/** Reintenta conflictos revertidos o un fallo de adquisición antes de ejecutar trabajo. */
export async function withBalanceTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let started = false
    try {
      return await prisma.$transaction(async tx => {
        started = true
        return work(tx)
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 15000 })
    } catch (error) {
      const known = error instanceof Prisma.PrismaClientKnownRequestError
      const acquisitionTimeout = known && !started && error.code === 'P2028' && error.message.includes('Unable to start a transaction in the given time')
      if (attempt >= 2 || !known || (error.code !== 'P2034' && !acquisitionTimeout)) throw error
      await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)))
    }
  }
}

export function needsBalanceRenewal(entryDate: Date, lastYearProcessed: number, asOf = new Date()) {
  const { cycleStart } = getCycleBounds(entryDate, asOf)
  const yearsCompleted = cycleStart.getUTCFullYear() - entryDate.getUTCFullYear()
  return yearsCompleted >= 1 && yearsCompleted > lastYearProcessed
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
  if (!balance || !needsBalanceRenewal(entryDate, balance.lastYearProcessed, asOf)) return false
  const { cycleStart } = getCycleBounds(entryDate, asOf)
  const yearsCompleted = cycleStart.getUTCFullYear() - entryDate.getUTCFullYear()
  const { usedDays, pendingDays } = await getCycleUsage(tx, userId, entryDate, asOf)
  await tx.vacationBalance.update({
    where: { userId },
    data: { totalDays: getDaysByYears(yearsCompleted), usedDays, pendingDays, lastYearProcessed: yearsCompleted, lastUpdated: asOf },
  })
  return true
}
