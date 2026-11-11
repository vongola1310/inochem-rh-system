'use server'

import { revalidatePath } from 'next/cache'
import { attendanceActor, actionError, fail } from '@/lib/attendance/access'
import { asJson, attendanceTransaction, checkVersion, notifyHR } from '@/lib/attendance/service'
import { isReviewNotApplicable } from '@/lib/attendance/review-policy'

export async function submitAttendanceJustification(form: FormData) {
  return { success: false, message: 'La asistencia del colaborador es de solo lectura. Únicamente el jefe asignado puede justificar o dictaminar incidencias.' }
}

export async function reviewAttendanceDay(form: FormData) {
  try {
    const actor = await attendanceActor()
    const id = String(form.get('dayId') || ''), version = checkVersion(form.get('version'))
    const decision = String(form.get('decision') || '')
    const comment = String(form.get('comment') || '').trim()
    const options = ['JUSTIFIED', 'INCIDENT', 'LATE', 'ABSENCE', 'EARLY_EXIT', 'LATE_EARLY_EXIT'] as const
    if (!options.includes(decision as typeof options[number])) fail('Selecciona un dictamen válido.')
    if (comment.length < 5 || comment.length > 4000) fail('Explica el dictamen en 5 a 4,000 caracteres.')
    await attendanceTransaction(async tx => {
      const day = await tx.attendanceDay.findUnique({ where: { id }, include: { user: { select: { isBlacklisted: true } }, batch: { select: { status: true, needsRefresh: true } } } })
      if (!day || day.managerId !== actor.id || day.userId === actor.id) fail('Solo el responsable asignado puede dictaminar esta incidencia.')
      if (day.user.isBlacklisted) fail('El colaborador está en lista negra y no participa en incidencias.')
      if (isReviewNotApplicable(day.evidence)) fail('N/A — Este registro no requiere dictamen.')
      if (day.batch.status !== 'PUBLISHED' || day.batch.needsRefresh) fail('RH debe actualizar o abrir el periodo antes de continuar.')
      if (!['WAITING_EMPLOYEE', 'WAITING_MANAGER'].includes(day.reviewStatus) || day.version !== version) fail('La incidencia cambió o ya fue dictaminada. Actualiza la página.')
      const changed = await tx.attendanceDay.updateMany({ where: { id, managerId: actor.id, version, reviewStatus: { in: ['WAITING_EMPLOYEE', 'WAITING_MANAGER'] } }, data: {
        decision: decision as 'JUSTIFIED' | 'INCIDENT' | 'LATE' | 'ABSENCE' | 'EARLY_EXIT' | 'LATE_EARLY_EXIT',
        reviewStatus: 'RESOLVED', managerComment: comment,
        reviewedById: actor.id, reviewedAt: new Date(), version: { increment: 1 },
      } })
      if (changed.count !== 1) fail('El dictamen ya fue procesado.')
      await tx.attendanceEvent.create({ data: { importId: day.importId, dayId: id, actorId: actor.id, action: 'MANAGER_REVIEWED', details: asJson({ decision, comment, justification: day.justification }) } })
      await tx.notification.create({ data: { userId: day.userId, title: 'Dictamen de asistencia disponible', message: 'Tu responsable terminó la revisión. Consulta el dictamen en tu portal.', link: `/attendance?period=${day.importId}` } })
      await notifyHR(tx, `${actor.name} emitió un dictamen de asistencia. El reporte está actualizado.`, day.importId)
    })
    revalidatePath('/attendance'); revalidatePath('/admin/attendance', 'layout'); revalidatePath('/')
    return { success: true, message: 'Dictamen guardado y disponible para RH.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}
