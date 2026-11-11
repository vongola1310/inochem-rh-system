import type { Prisma } from '@prisma/client'

export async function markAttendanceStale(tx: Prisma.TransactionClient, start: Date, end: Date, userId?: string) {
  const startDay = new Date(start.toISOString().slice(0, 10) + 'T00:00:00Z')
  const endDay = new Date(end.toISOString().slice(0, 10) + 'T00:00:00Z')
  await tx.attendanceImport.updateMany({
    where: { status: { in: ['PUBLISHED', 'CLOSED'] }, startDate: { lte: endDay }, endDate: { gte: startDay }, ...(userId ? { days: { some: { userId } } } : {}) },
    data: { needsRefresh: true },
  })
}
