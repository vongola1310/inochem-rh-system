import type { Prisma } from '@prisma/client'
import { evaluateImport } from './service'
import { dateKey, parseDate } from './dates'
import { periodTotals } from './engine'
import { isReviewNotApplicable } from './review-policy'
import { getFieldWork } from './field-evidence'
import { fail } from './access'

export async function attendanceReport(tx: Prisma.TransactionClient, id: string) {
  const batch = await tx.attendanceImport.findUnique({ where: { id } })
  if (!batch || batch.status === 'DRAFT') fail('El periodo todavía no está publicado.')
  const fresh = await evaluateImport(tx, batch)
  const stale = batch.needsRefresh || batch.previewHash !== fresh.hash
  const days = await tx.attendanceDay.findMany({ where: { importId: id, isWorkday: true, user: { isBlacklisted: false } }, include: {
    user: { select: { name: true, employeeNumber: true } }, manager: { select: { name: true } },
  }, orderBy: [{ date: 'asc' }, { userId: 'asc' }] })
  const totals = periodTotals(days.map(day => ({ ...day, needsRefresh: stale })), dateKey(batch.startDate), dateKey(batch.endDate)).map(total => ({
    ...total, fieldDays: days.filter(day => day.userId === total.userId && !isReviewNotApplicable(day.evidence) && getFieldWork(day.evidence).length > 0).length,
  }))
  return { batch, days, totals, stale, preview: fresh.preview, employees: fresh.employees, period: fresh.preview.period! }
}
