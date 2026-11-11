import type { Prisma } from '@prisma/client'

// Solo señala que cambió una fuente. El cálculo se ejecuta desde Biochecadores.
export async function markFieldAffectedPeriods(tx: Prisma.TransactionClient, startDate: Date, endDate: Date) {
  await tx.attendanceImport.updateMany({ where: {
    status: { in: ['PUBLISHED', 'CLOSED'] }, startDate: { lte: endDate }, endDate: { gte: startDate },
  }, data: { needsRefresh: true } })
}

