'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { attendanceActor, actionError, fail } from '@/lib/attendance/access'
import { asJson, attendanceContext, attendanceTransaction, checkVersion, digest, evaluateImport, notifyAttendanceManagers } from '@/lib/attendance/service'
import { refreshAttendanceEvaluation } from '@/lib/attendance/refresh'
import { buildPreview } from '@/lib/attendance/engine'
import { initialReviewState, isReviewNotApplicable, REVIEWER_NOT_APPLICABLE, requiresReview } from '@/lib/attendance/review-policy'
import { dateKey, datesBetween, parseDate, todayInMexico } from '@/lib/attendance/dates'
import { parseBiocheckFile } from '@/lib/attendance/parser'
import { RULES_VERSION, type ImportConfiguration, type SourceFile } from '@/lib/attendance/types'

const configurationSchema = z.object({
  includedUserIds: z.array(z.string().min(1).max(100)).min(1).max(2000),
  excludedUsers: z.record(z.string().max(500)),
  mappings: z.record(z.object({ userId: z.string().max(100).nullable(), reason: z.string().max(500) })),
  reviewers: z.record(z.string().max(100)),
  sites: z.record(z.enum(['AJUSCO', 'PERIFERICO'])).optional(),
})

export async function createAttendanceDraft(form: FormData) {
  try {
    const actor = await attendanceActor(['HR'])
    const start = String(form.get('startDate') || ''), end = String(form.get('endDate') || '')
    try { datesBetween(start, end) } catch (error) { fail((error as Error).message) }
    if (end >= todayInMexico()) fail('Importa un periodo terminado, hasta ayer, para no evaluar jornadas que siguen en curso.')
    const sources: SourceFile[] = []
    for (const site of ['AJUSCO', 'PERIFERICO'] as const) {
      const file = form.get(site) as File | null
      if (!file || typeof file.arrayBuffer !== 'function' || !file.size) fail('Selecciona los dos archivos: Ajusco y Periférico.')
      if (file.size > 3 * 1024 * 1024) fail('Cada archivo puede pesar como máximo 3 MB.')
      try { sources.push(parseBiocheckFile(Buffer.from(await file.arrayBuffer()), file.name, site, start, end)) }
      catch (error) { fail((error as Error).message) }
    }
    const sourceDigest = digest({ start, end, files: sources.map(s => s.digest) })
    const id = await attendanceTransaction(async tx => {
      const existing = await tx.attendanceImport.findUnique({ where: { sourceDigest }, select: { id: true } })
      if (existing) return existing.id
      const context = await attendanceContext(tx, start, end, undefined, sources)
      const configuration: ImportConfiguration = { includedUserIds: context.employees.filter(e => !e.isBlacklisted).map(e => e.id), excludedUsers: Object.fromEntries(context.employees.filter(e => e.isBlacklisted).map(e => [e.id, 'Lista negra al crear el periodo'])), mappings: {}, reviewers: {} }
      const preview = buildPreview({ start, end, sources, ...context, config: configuration })
      const batch = await tx.attendanceImport.create({ data: {
        startDate: parseDate(start), endDate: parseDate(end), sourceDigest, sources: asJson(sources), configuration: asJson(configuration),
        preview: asJson(preview), previewHash: digest({ rules: RULES_VERSION, preview }), rulesVersion: RULES_VERSION, createdById: actor.id,
      } })
      await tx.attendanceEvent.create({ data: { importId: batch.id, actorId: actor.id, action: 'DRAFT_CREATED', details: asJson({ sourceDigest, files: sources.map(s => ({ name: s.name, digest: s.digest, rows: s.rowCount })) }) } })
      return batch.id
    })
    revalidatePath('/admin/attendance')
    return { success: true, message: 'Borrador creado. Revisa el padrón y la tabla antes de enviar.', id }
  } catch (error) { return { success: false, message: actionError(error) } }
}

export async function updateAttendanceDraft(form: FormData) {
  try {
    const actor = await attendanceActor(['HR'])
    const id = String(form.get('importId') || ''), version = checkVersion(form.get('version'))
    let configuration: ImportConfiguration
    try { configuration = configurationSchema.parse(JSON.parse(String(form.get('configuration') || ''))) }
    catch { fail('La configuración del padrón o las vinculaciones no es válida.') }
    await attendanceTransaction(async tx => {
      const batch = await tx.attendanceImport.findUnique({ where: { id } })
      if (!batch || batch.status !== 'DRAFT' || batch.version !== version) fail('El borrador cambió. Actualiza la página.')
      const { preview, hash } = await evaluateImport(tx, { ...batch, configuration })
      const changed = await tx.attendanceImport.updateMany({ where: { id, version, status: 'DRAFT' }, data: {
        configuration: asJson(configuration), preview: asJson(preview), previewHash: hash, version: { increment: 1 },
      } })
      if (changed.count !== 1) fail('El borrador fue modificado por otra persona.')
      await tx.attendanceEvent.create({ data: { importId: id, actorId: actor.id, action: 'DRAFT_RECALCULATED', details: asJson({ configuration, previewHash: hash }) } })
    })
    revalidatePath(`/admin/attendance/${id}`)
    return { success: true, message: 'Vista previa actualizada. Revisa la tabla calculada antes de confirmar.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}

export async function publishAttendanceImport(form: FormData) {
  try {
    const actor = await attendanceActor(['HR'])
    const id = String(form.get('importId') || ''), version = checkVersion(form.get('version'))
    if (form.get('confirmed') !== 'yes') fail('Confirma que revisaste el padrón y las incidencias.')
    await attendanceTransaction(async tx => {
      const batch = await tx.attendanceImport.findUnique({ where: { id } })
      if (!batch || batch.status !== 'DRAFT' || batch.version !== version) fail('Este borrador ya fue publicado o cambió. Actualiza la página.')
      const { preview, hash } = await evaluateImport(tx, batch)
      if (hash !== batch.previewHash) fail('Cambió una autorización o el padrón. Actualiza y revisa la vista previa antes de enviar.')
      if (preview.errors.length) fail(preview.errors[0])
      if (!preview.days.length) fail('El periodo no contiene días laborales para los colaboradores elegidos.')
      const duplicates = await tx.attendanceDay.count({ where: { userId: { in: [...new Set(preview.days.map(d => d.userId))] }, date: { gte: batch.startDate, lte: batch.endDate } } })
      if (duplicates) fail('Hay colaboradores y fechas ya publicados en otro periodo. Ajusta el periodo o el padrón para evitar duplicados.')
      const updated = await tx.attendanceImport.updateMany({ where: { id, status: 'DRAFT', version }, data: {
        status: 'PUBLISHED', publishedById: actor.id, publishedAt: new Date(), needsRefresh: false, version: { increment: 1 },
      } })
      if (updated.count !== 1) fail('La publicación ya fue procesada.')
      await tx.attendanceDay.createMany({ data: preview.days.map(day => ({ ...day, date: parseDate(day.date), evidence: asJson(day.evidence), importId: id,
        ...initialReviewState(day),
      })) })
      const users = [...new Set(preview.days.filter(day => !isReviewNotApplicable(day.evidence)).map(day => day.userId))]
      if (users.length) await tx.notification.createMany({ data: users.map(userId => {
        const count = preview.days.filter(day => day.userId === userId && requiresReview(day)).length
        return { userId, title: 'Revisión de asistencia', message: count ? `Tienes ${count} días con incidencias que revisará tu jefe en el periodo ${dateKey(batch.startDate)} a ${dateKey(batch.endDate)}.` : 'Tu periodo de asistencia está disponible, sin incidencias pendientes.', link: `/attendance?period=${id}` }
      }) })
      await notifyAttendanceManagers(tx, preview.days, id)
      await tx.attendanceEvent.create({ data: { importId: id, actorId: actor.id, action: 'PUBLISHED', details: asJson({ previewHash: hash, days: preview.days.length, recipients: users.length }) } })
    })
    revalidatePath(`/admin/attendance/${id}`); revalidatePath('/attendance'); revalidatePath('/')
    return { success: true, message: 'Periodo publicado. Se notificó a los colaboradores que participan en el proceso; los registros N/A conservan sus checadas sin enviar incidencias.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}

export async function refreshAttendanceImport(form: FormData) {
  try {
    const actor = await attendanceActor(['HR'])
    const id = String(form.get('importId') || ''), version = checkVersion(form.get('version'))
    await attendanceTransaction(async tx => {
      const batch = await tx.attendanceImport.findUnique({ where: { id } })
      if (!batch || batch.status === 'DRAFT' || batch.version !== version) fail('El periodo cambió. Actualiza la página.')
      await refreshAttendanceEvaluation(tx, batch, actor.id)
    })
    revalidatePath(`/admin/attendance/${id}`); revalidatePath('/attendance')
    return { success: true, message: 'Autorizaciones actualizadas. Se conservaron los dictámenes sin cambios de evidencia.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}

export async function updateAttendanceSites(form: FormData) {
  try {
    const actor = await attendanceActor(['HR']), id = String(form.get('importId') || ''), version = checkVersion(form.get('version'))
    const parsed = z.record(z.enum(['AJUSCO', 'PERIFERICO'])).safeParse(Object.fromEntries([...form.entries()].filter(([key, value]) => key.startsWith('site:') && value !== '').map(([key, value]) => [key.slice(5), value])))
    if (!parsed.success) fail('Selecciona una sede válida por colaborador.')
    await attendanceTransaction(async tx => {
      const batch = await tx.attendanceImport.findUnique({ where: { id } })
      if (!batch || batch.status === 'DRAFT' || batch.version !== version) fail('El periodo cambió. Actualiza la página.')
      const configuration = batch.configuration as unknown as ImportConfiguration
      if (Object.keys(parsed.data).some(userId => !configuration.includedUserIds.includes(userId))) fail('La sede debe corresponder a un colaborador del padrón de este periodo.')
      await tx.attendanceImport.update({ where: { id, version }, data: { configuration: asJson({ ...configuration, sites: parsed.data }), needsRefresh: true, version: { increment: 1 } } })
      await tx.attendanceEvent.create({ data: { importId: id, actorId: actor.id, action: 'ATTENDANCE_SITES_UPDATED', details: asJson({ before: configuration.sites || {}, after: parsed.data }) } })
    })
    revalidatePath('/admin/attendance/' + id)
    return { success: true, message: 'Sedes guardadas. Actualiza el cruce para aplicar las jornadas correspondientes.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}

export async function closeAttendanceImport(form: FormData) {
  try {
    const actor = await attendanceActor(['HR'])
    const id = String(form.get('importId') || ''), version = checkVersion(form.get('version'))
    await attendanceTransaction(async tx => {
      const batch = await tx.attendanceImport.findUnique({ where: { id } })
      if (!batch || batch.status !== 'PUBLISHED' || batch.version !== version) fail('El periodo no está disponible para cierre.')
      const { hash } = await evaluateImport(tx, batch)
      if (batch.needsRefresh || hash !== batch.previewHash) fail('Actualiza las autorizaciones antes de cerrar el periodo.')
      if (await tx.attendanceDay.count({ where: { importId: id, isWorkday: true, user: { isBlacklisted: false }, reviewStatus: { not: 'RESOLVED' } } })) fail('Faltan dictámenes del jefe.')
      await tx.attendanceImport.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date(), version: { increment: 1 } } })
      await tx.attendanceEvent.create({ data: { importId: id, actorId: actor.id, action: 'CLOSED', details: {} } })
    })
    revalidatePath(`/admin/attendance/${id}`); revalidatePath('/admin/attendance')
    return { success: true, message: 'Periodo cerrado. El reporte final está disponible.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}
