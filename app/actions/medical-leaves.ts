'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { attendanceActor, actionError, fail } from '@/lib/attendance/access'
import { asJson, attendanceTransaction, checkVersion, markAttendanceStale } from '@/lib/attendance/service'
import { calendarDays, parseDate } from '@/lib/attendance/dates'

const leaveSchema = z.object({
  userId: z.string().min(1).max(100), startDate: z.string(), endDate: z.string(),
  series: z.string().trim().min(1).max(40), folio: z.string().trim().min(1).max(100),
  kind: z.enum(['MATERNAL', 'GENERAL', 'WORK_RISK']), notes: z.string().trim().max(4000),
})

export async function saveMedicalLeave(form: FormData) {
  try {
    const actor = await attendanceActor(['HR', 'ADMIN'])
    const result = leaveSchema.safeParse(Object.fromEntries(['userId', 'startDate', 'endDate', 'series', 'folio', 'kind', 'notes'].map(key => [key, form.get(key) || ''])))
    if (!result.success) fail('Completa colaborador, fechas, serie, folio y tipo. Las notas admiten hasta 4,000 caracteres.')
    const data = result.data
    let days: number, startDate: Date, endDate: Date
    try { days = calendarDays(data.startDate, data.endDate); startDate = parseDate(data.startDate); endDate = parseDate(data.endDate) }
    catch (error) { fail((error as Error).message) }
    const id = String(form.get('id') || '')
    await attendanceTransaction(async tx => {
      if (!await tx.user.findUnique({ where: { id: data.userId }, select: { id: true } })) fail('El colaborador ya no existe.')
      const before = id ? await tx.medicalLeave.findUnique({ where: { id } }) : null
      if (id && (!before || before.cancelledAt || before.userId !== data.userId || before.version !== checkVersion(form.get('version')))) fail('La incapacidad cambió o fue cancelada. Actualiza la página.')
      if (await tx.medicalLeave.count({ where: { userId: data.userId, cancelledAt: null, id: { not: id || undefined }, startDate: { lte: endDate }, endDate: { gte: startDate } } })) fail('Ya existe una incapacidad vigente que se cruza con estas fechas para el colaborador.')
      const payload = { ...data, startDate, endDate, calendarDays: days, updatedById: actor.id }
      const saved = before
        ? await tx.medicalLeave.update({ where: { id }, data: { ...payload, version: { increment: 1 } } })
        : await tx.medicalLeave.create({ data: { ...payload, createdById: actor.id } })
      await markAttendanceStale(tx, startDate, endDate, data.userId)
      if (before) await markAttendanceStale(tx, before.startDate, before.endDate, data.userId)
      await tx.attendanceEvent.create({ data: { actorId: actor.id, action: before ? 'MEDICAL_LEAVE_UPDATED' : 'MEDICAL_LEAVE_CREATED', details: asJson({ before, after: saved }) } })
    })
    revalidatePath('/admin/medical-leaves'); revalidatePath('/admin/attendance', 'layout'); revalidatePath('/')
    return { success: true, message: `Incapacidad guardada: ${days} días corridos. Los periodos afectados de asistencia requieren actualizar su evaluación.` }
  } catch (error) { return { success: false, message: actionError(error) } }
}

export async function cancelMedicalLeave(form: FormData) {
  try {
    const actor = await attendanceActor(['HR', 'ADMIN'])
    const id = String(form.get('id') || ''), version = checkVersion(form.get('version'))
    const reason = String(form.get('reason') || '').trim()
    if (reason.length < 5 || reason.length > 500) fail('Indica el motivo de cancelación (5 a 500 caracteres).')
    await attendanceTransaction(async tx => {
      const before = await tx.medicalLeave.findUnique({ where: { id } })
      if (!before || before.cancelledAt || before.version !== version) fail('La incapacidad cambió o ya está cancelada.')
      await tx.medicalLeave.update({ where: { id }, data: { cancelledAt: new Date(), cancelReason: reason, updatedById: actor.id, version: { increment: 1 } } })
      await markAttendanceStale(tx, before.startDate, before.endDate, before.userId)
      await tx.attendanceEvent.create({ data: { actorId: actor.id, action: 'MEDICAL_LEAVE_CANCELLED', details: asJson({ before, reason }) } })
    })
    revalidatePath('/admin/medical-leaves'); revalidatePath('/admin/attendance', 'layout'); revalidatePath('/')
    return { success: true, message: 'Incapacidad cancelada. Se conservó el registro para auditoría.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}
