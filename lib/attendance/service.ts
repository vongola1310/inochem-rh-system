import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildPreview } from './engine'
import { addDateDays, dateKey, parseDate, todayInMexico } from './dates'
import { buildFieldPreview } from '@/lib/field-reports/preview'
import type { FieldSource, FieldMapping } from '@/lib/field-reports/types'
import { attendanceSites } from './site'
import { resolveWorkday } from './workday'
import { RULES_VERSION, type ImportConfiguration, type SourceFile, type Evaluation, type FieldWorkEvidence } from './types'
import { requiresReview, REVIEWER_NOT_APPLICABLE } from './review-policy'
import { fail } from './access'
export { markAttendanceStale } from './staleness'

export async function attendanceTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 }) }
    catch (error) {
      if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error
    }
  }
}

export const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
function orderedJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(orderedJson)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, orderedJson(entry)]))
  return value
}
// PostgreSQL JSONB cambia el orden de las claves. El hash representa datos, no su orden textual.
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(orderedJson(JSON.parse(JSON.stringify(value))))).digest('hex')

export async function attendanceContext(tx: Prisma.TransactionClient, start: string, end: string, config?: ImportConfiguration, sources: SourceFile[] = []) {
  const [employees, requests, leaves, holidays, fieldReports, schedules] = await Promise.all([
    tx.user.findMany({ select: { id: true, employeeNumber: true, name: true, entryDate: true, bossId: true, isBlacklisted: true }, orderBy: { id: 'asc' } }),
    tx.request.findMany({ where: { startDate: { lt: parseDate(addDateDays(end, 1)) }, OR: [
      { returnDate: { gte: parseDate(start) } }, { endDate: { gte: parseDate(start) } }, { startDate: { gte: parseDate(start) } },
    ] }, select: { id: true, userId: true, type: true, status: true, approvedByBoss: true, startDate: true, returnDate: true, endDate: true, permitTime: true }, orderBy: { id: 'asc' } }),
    tx.medicalLeave.findMany({ where: { cancelledAt: null, startDate: { lte: parseDate(end) }, endDate: { gte: parseDate(start) } },
      select: { id: true, userId: true, startDate: true, endDate: true, cancelledAt: true }, orderBy: { id: 'asc' } }),
    tx.holiday.findMany({ where: { date: { gte: parseDate(start), lt: parseDate(addDateDays(end, 1)) } }, select: { date: true }, orderBy: { date: 'asc' } }),
    tx.fieldReport.findMany({ where: { status: 'CONFIRMED', startDate: { lte: parseDate(end) }, endDate: { gte: parseDate(start) } }, select: { id: true, startDate: true, endDate: true, source: true, mappings: true }, orderBy: { id: 'asc' } }),
    tx.reducedWorkday.findMany({ where: { cancelledAt: null, startDate: { lte: parseDate(end) }, endDate: { gte: parseDate(start) } }, orderBy: { id: 'asc' } }),
  ])
  const fieldWork: FieldWorkEvidence[] = [], fieldErrors: string[] = [], fieldWarnings: string[] = []
  const fieldReferences: { id: string; fileName: string }[] = []
  const siteFor = attendanceSites(sources, employees, config || { includedUserIds: [], excludedUsers: {}, mappings: {}, reviewers: {} })
  for (const report of fieldReports) {
    const source = report.source as unknown as FieldSource
    const preview = buildFieldPreview({ source, mappings: report.mappings as unknown as FieldMapping, employees,
      start: start > dateKey(report.startDate) ? start : dateKey(report.startDate), end: end < dateKey(report.endDate) ? end : dateKey(report.endDate),
      holidays: holidays.map(h => dateKey(h.date)), today: todayInMexico(), workdayFor: (userId, date) => ({ ...resolveWorkday(date, siteFor(userId, date), schedules), ...(config?.reviewers[userId] === REVIEWER_NOT_APPLICABLE || (config && !config.includedUserIds.includes(userId)) ? { ambiguous: false } : {}) }) })
    fieldReferences.push({ id: report.id, fileName: source.fileName })
    fieldWork.push(...preview.days.map(day => ({ ...day, reportId: report.id })))
    fieldErrors.push(...preview.errors.map(error => source.fileName + ': ' + error))
    if (preview.omitted.length) fieldWarnings.push(source.fileName + ': ' + preview.omitted.length + ' registros de campo no aplican al cruce de este periodo (fechas, horarios incompletos o exclusiones). Se conservan en la referencia.')
  }
  return { employees, requests, leaves, holidays: holidays.map(h => dateKey(h.date)), fieldWork, fieldErrors, fieldWarnings, fieldReferences, schedules }
}

export async function evaluateImport(tx: Prisma.TransactionClient, batch: { startDate: Date; endDate: Date; sources: unknown; configuration: unknown }) {
  const start = dateKey(batch.startDate), end = dateKey(batch.endDate)
  const context = await attendanceContext(tx, start, end, batch.configuration as ImportConfiguration, batch.sources as SourceFile[])
  const preview = buildPreview({ start, end, ...context, sources: batch.sources as SourceFile[], config: batch.configuration as ImportConfiguration })
  return { preview, hash: digest({ rules: RULES_VERSION, preview }), employees: context.employees }
}

export function checkVersion(value: FormDataEntryValue | null): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) fail('Versión inválida. Actualiza la página.')
  const version = Number(value)
  if (!Number.isSafeInteger(version)) fail('Versión inválida.')
  return version
}

export async function notifyHR(tx: Prisma.TransactionClient, message: string, importId: string) {
  const recipients = await tx.user.findMany({ where: { role: 'HR', isBlacklisted: false }, select: { id: true } })
  if (recipients.length) await tx.notification.createMany({ data: recipients.map(user => ({ userId: user.id, title: 'Dictamen de incidencias', message, link: `/admin/attendance/${importId}` })) })
}

export async function notifyAttendanceManagers(tx: Prisma.TransactionClient, days: Evaluation[], importId: string) {
  const ids = [...new Set(days.filter(requiresReview).map(day => day.managerId).filter((id): id is string => !!id))]
  const managers = await tx.user.findMany({ where: { id: { in: ids }, isBlacklisted: false }, select: { id: true } })
  if (managers.length) await tx.notification.createMany({ data: managers.map(manager => ({
    userId: manager.id, title: 'Incidencias por dictaminar',
    message: 'Hay incidencias de tu equipo para revisar. Decide si se justifican y registra el motivo; el colaborador tiene acceso de solo lectura.',
    link: `/attendance?view=team&period=${importId}`,
  })) })
}
