'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { actionError, fail } from '@/lib/attendance/access'
import { attendanceTransaction, asJson, checkVersion } from '@/lib/attendance/service'
import { addDateDays, dateKey, datesBetween, parseDate, todayInMexico } from '@/lib/attendance/dates'
import { fieldReportActor } from '@/lib/field-reports/access'
import { parseFieldReport } from '@/lib/field-reports/parser'
import { suggestFieldMappings } from '@/lib/field-reports/preview'
import { markFieldAffectedPeriods } from '@/lib/field-reports/service'
import type { FieldSource } from '@/lib/field-reports/types'
import type { Prisma } from '@prisma/client'

const mappingSchema = z.record(z.object({ userId: z.string().max(100).nullable(), reason: z.string().max(500) }))
function refreshPages() {
  revalidatePath('/field-reports', 'layout'); revalidatePath('/admin/attendance', 'layout'); revalidatePath('/')
}
async function recordUpload(tx: Prisma.TransactionClient, actor: { id: string; receivesFieldReportReminders: boolean }) {
  if (actor.receivesFieldReportReminders) await tx.fieldReportSchedule.upsert({ where: { userId: actor.id }, create: { userId: actor.id, nextDueDate: parseDate(addDateDays(todayInMexico(), 14)) }, update: { nextDueDate: parseDate(addDateDays(todayInMexico(), 14)), lastReminderDate: null } })
  await tx.notification.updateMany({ where: { userId: actor.id, link: '/field-reports', title: 'Subir reporte de personal de campo', isRead: false }, data: { isRead: true } })
}

export async function createFieldReport(form: FormData) {
  try {
    const actor = await fieldReportActor()
    const start = String(form.get('startDate') || ''), end = String(form.get('endDate') || '')
    try { datesBetween(start, end) } catch (error) { fail((error as Error).message) }
    if (end >= todayInMexico()) fail('Selecciona un periodo terminado, hasta ayer.')
    const file = form.get('report') as File | null
    if (!file || typeof file.arrayBuffer !== 'function' || !file.size || file.size > 3 * 1024 * 1024) fail('Selecciona un Excel de Salesforce de hasta 3 MB.')
    let source: FieldSource
    try {
      const bytes = Buffer.from(await file.arrayBuffer())
      source = { ...parseFieldReport(bytes, file.name), originalFileBase64: bytes.toString('base64') }
    } catch (error) { fail((error as Error).message) }
    const id = await attendanceTransaction(async tx => {
      const old = await tx.fieldReport.findFirst({ where: { managerId: actor.id, sourceDigest: source.digest, startDate: parseDate(start), endDate: parseDate(end) } })
      if (old) {
        if (old.status === 'CANCELLED') fail('Este archivo ya tiene una referencia cancelada para el periodo. Elimínala desde Reportes de campo antes de volver a cargarlo.')
        if (old.status === 'DRAFT' || !(old.source as unknown as FieldSource).originalFileBase64) {
          await tx.fieldReport.update({ where: { id: old.id, version: old.version }, data: {
            source: asJson({ ...(old.source as unknown as FieldSource), originalFileBase64: source.originalFileBase64 }),
            status: 'CONFIRMED', confirmedAt: old.confirmedAt || new Date(), version: { increment: 1 },
          } })
          if (old.status === 'DRAFT') await markFieldAffectedPeriods(tx, old.startDate, old.endDate)
          await recordUpload(tx, actor)
          await tx.attendanceEvent.create({ data: { actorId: actor.id, action: 'FIELD_REFERENCE_ORIGINAL_RESTORED', details: { fieldReportId: old.id, sourceDigest: source.digest } } })
        }
        return old.id
      }
      const employees = await tx.user.findMany({ select: { id: true, name: true, employeeNumber: true, isBlacklisted: true, entryDate: true } })
      const report = await tx.fieldReport.create({ data: { managerId: actor.id, startDate: parseDate(start), endDate: parseDate(end), sourceDigest: source.digest,
        source: asJson(source), mappings: asJson(suggestFieldMappings(source, employees)), coverageMode: 'RANGE', status: 'CONFIRMED', confirmedAt: new Date() } })
      await markFieldAffectedPeriods(tx, report.startDate, report.endDate)
      await recordUpload(tx, actor)
      await tx.attendanceEvent.create({ data: { actorId: actor.id, action: 'FIELD_REFERENCE_SAVED', details: { fieldReportId: report.id, sourceDigest: source.digest, rows: source.records.length } } })
      return report.id
    })
    refreshPages()
    return { success: true, message: 'Archivo guardado como referencia. Se cruzará con las checadas al importar o actualizar el periodo de biochecadores.', id }
  } catch (error) { return { success: false, message: actionError(error) } }
}

export async function saveFieldReportMappings(form: FormData) {
  try {
    const actor = await fieldReportActor(), id = String(form.get('reportId') || ''), version = checkVersion(form.get('version'))
    let mappings: z.infer<typeof mappingSchema>
    try { mappings = mappingSchema.parse(JSON.parse(String(form.get('mappings') || ''))) } catch { fail('Las correspondencias no son válidas.') }
    await attendanceTransaction(async tx => {
      const report = await tx.fieldReport.findUnique({ where: { id } })
      if (!report || report.managerId !== actor.id || report.status === 'CANCELLED' || report.version !== version) fail('El reporte cambió o no te corresponde.')
      await tx.fieldReport.update({ where: { id, version }, data: { mappings: asJson(mappings), version: { increment: 1 } } })
      if (report.status === 'CONFIRMED') await markFieldAffectedPeriods(tx, report.startDate, report.endDate)
      await tx.attendanceEvent.create({ data: { actorId: actor.id, action: 'FIELD_REPORT_MAPPINGS_SAVED', details: asJson({ fieldReportId: id, mappings }) } })
    })
    refreshPages()
    return { success: true, message: 'Correspondencias guardadas para el próximo cruce de biochecadores.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}

// Compatibilidad con los borradores anteriores: activar la fuente sin evaluar asistencia.
export async function confirmFieldReport(form: FormData) {
  try {
    const actor = await fieldReportActor(), id = String(form.get('reportId') || ''), version = checkVersion(form.get('version'))
    await attendanceTransaction(async tx => {
      const report = await tx.fieldReport.findUnique({ where: { id } })
      if (!report || report.managerId !== actor.id || report.status !== 'DRAFT' || report.version !== version) fail('El borrador cambió o ya está guardado como referencia.')
      await tx.fieldReport.update({ where: { id, version }, data: { status: 'CONFIRMED', confirmedAt: new Date(), version: { increment: 1 } } })
      await markFieldAffectedPeriods(tx, report.startDate, report.endDate)
      await recordUpload(tx, actor)
      await tx.attendanceEvent.create({ data: { actorId: actor.id, action: 'FIELD_REFERENCE_SAVED', details: { fieldReportId: id, sourceDigest: report.sourceDigest } } })
    })
    refreshPages()
    return { success: true, message: 'Referencia guardada. El cálculo se realizará desde el periodo de biochecadores.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}

export async function cancelFieldReport(form: FormData) {
  try {
    const actor = await fieldReportActor(), id = String(form.get('reportId') || ''), version = checkVersion(form.get('version'))
    const reason = String(form.get('reason') || '').trim()
    if (reason.length < 5 || reason.length > 500) fail('Escribe un motivo de cancelación de 5 a 500 caracteres.')
    await attendanceTransaction(async tx => {
      const report = await tx.fieldReport.findUnique({ where: { id } })
      if (!report || report.managerId !== actor.id || report.version !== version || report.status === 'CANCELLED') fail('El reporte cambió o no te corresponde.')
      await tx.fieldReport.update({ where: { id, version }, data: { status: 'CANCELLED', version: { increment: 1 } } })
      if (report.status === 'CONFIRMED') {
        await markFieldAffectedPeriods(tx, report.startDate, report.endDate)
        await tx.fieldReportSchedule.updateMany({ where: { userId: actor.id }, data: { nextDueDate: parseDate(todayInMexico()), lastReminderDate: null } })
      }
      await tx.attendanceEvent.create({ data: { actorId: actor.id, action: 'FIELD_REPORT_CANCELLED', details: { fieldReportId: id, reason } } })
    })
    refreshPages()
    return { success: true, message: 'Referencia cancelada. RH podrá actualizar los periodos afectados desde Biochecadores; los dictámenes actuales se conservan hasta entonces.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}

export async function deleteFieldReport(form: FormData) {
  try {
    const actor = await fieldReportActor(), id = String(form.get('reportId') || ''), version = checkVersion(form.get('version'))
    if (form.get('confirmation') !== 'ELIMINAR') fail('Escribe ELIMINAR para confirmar el borrado del reporte de campo.')
    await attendanceTransaction(async tx => {
      const report = await tx.fieldReport.findUnique({ where: { id } })
      if (!report || report.version !== version || (report.managerId !== actor.id && !['HR', 'ADMIN'].includes(actor.role))) fail('El reporte cambió o no tienes permiso para eliminarlo.')
      if (report.status === 'CONFIRMED') await markFieldAffectedPeriods(tx, report.startDate, report.endDate)
      await tx.notification.deleteMany({ where: { link: '/field-reports/' + id } })
      await tx.fieldReportDay.deleteMany({ where: { reportId: id } })
      await tx.fieldReport.delete({ where: { id, version } })
      if (report.status === 'CONFIRMED') await tx.fieldReportSchedule.updateMany({ where: { userId: report.managerId }, data: { nextDueDate: parseDate(todayInMexico()), lastReminderDate: null } })
      await tx.attendanceEvent.create({ data: { actorId: actor.id, action: 'FIELD_REPORT_DELETED', details: { deletedFieldReportId: id, sourceDigest: report.sourceDigest, startDate: dateKey(report.startDate), endDate: dateKey(report.endDate) } } })
    })
    refreshPages()
    return { success: true, message: 'Referencia eliminada. Los periodos afectados quedan pendientes de actualización desde Biochecadores.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}

