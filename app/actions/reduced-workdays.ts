'use server'

import { revalidatePath } from 'next/cache'
import { attendanceActor, actionError, fail } from '@/lib/attendance/access'
import { asJson, attendanceTransaction, checkVersion, markAttendanceStale } from '@/lib/attendance/service'
import { datesBetween, parseDate, timeSeconds } from '@/lib/attendance/dates'

function refresh() { revalidatePath('/admin/reduced-workdays'); revalidatePath('/admin/attendance', 'layout') }
export async function saveReducedWorkday(form: FormData) {
  try {
    const actor = await attendanceActor(['HR', 'ADMIN'])
    const start = String(form.get('startDate') || ''), end = String(form.get('endDate') || ''), site = String(form.get('site') || '')
    try { datesBetween(start, end) } catch (error) { fail((error as Error).message) }
    if (!['AJUSCO', 'PERIFERICO', 'BOTH'].includes(site)) fail('Selecciona Ajusco, Periférico o ambas sedes.')
    const startSeconds = timeSeconds(String(form.get('startTime') || '')), endSeconds = timeSeconds(String(form.get('endTime') || ''))
    if (startSeconds === null || endSeconds === null || startSeconds < 28800 || endSeconds > 61200 || endSeconds <= startSeconds || endSeconds - startSeconds >= 32400) fail('Elige una jornada más corta, dentro de las 08:00 y las 17:00, con salida posterior a la entrada.')
    const notes = String(form.get('notes') || '').trim()
    if (notes.length > 1000) fail('Las notas admiten hasta 1,000 caracteres.')
    const id = String(form.get('id') || ''), startDate = parseDate(start), endDate = parseDate(end)
    await attendanceTransaction(async tx => {
      const before = id ? await tx.reducedWorkday.findUnique({ where: { id } }) : null
      if (id && (!before || before.cancelledAt || before.version !== checkVersion(form.get('version')))) fail('La jornada cambió o fue cancelada. Actualiza la página.')
      if (await tx.reducedWorkday.count({ where: { id: { not: id || undefined }, cancelledAt: null, startDate: { lte: endDate }, endDate: { gte: startDate }, ...(site === 'BOTH' ? {} : { site: { in: [site, 'BOTH'] } }) } })) fail('Ya existe una jornada reducida para esa sede y fechas. Edita el registro existente o elige otro periodo.')
      const data = { startDate, endDate, site, startSeconds, endSeconds, notes, updatedById: actor.id }
      const saved = before ? await tx.reducedWorkday.update({ where: { id, version: before.version }, data: { ...data, version: { increment: 1 } } }) : await tx.reducedWorkday.create({ data: { ...data, createdById: actor.id } })
      await markAttendanceStale(tx, startDate, endDate)
      if (before) await markAttendanceStale(tx, before.startDate, before.endDate)
      await tx.attendanceEvent.create({ data: { actorId: actor.id, action: before ? 'REDUCED_WORKDAY_UPDATED' : 'REDUCED_WORKDAY_CREATED', details: asJson({ before, after: saved }) } })
    })
    refresh()
    return { success: true, message: 'Jornada guardada. Se aplicará al importar biochecadores o actualizar el cruce de los periodos afectados.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}
export async function cancelReducedWorkday(form: FormData) {
  try {
    const actor = await attendanceActor(['HR', 'ADMIN']), id = String(form.get('id') || ''), version = checkVersion(form.get('version'))
    await attendanceTransaction(async tx => {
      const before = await tx.reducedWorkday.findUnique({ where: { id } })
      if (!before || before.cancelledAt || before.version !== version) fail('La jornada cambió o ya fue cancelada.')
      await tx.reducedWorkday.update({ where: { id, version }, data: { cancelledAt: new Date(), updatedById: actor.id, version: { increment: 1 } } })
      await markAttendanceStale(tx, before.startDate, before.endDate)
      await tx.attendanceEvent.create({ data: { actorId: actor.id, action: 'REDUCED_WORKDAY_CANCELLED', details: asJson({ before }) } })
    })
    refresh()
    return { success: true, message: 'Jornada cancelada. Actualiza el cruce de los periodos afectados para aplicar el horario vigente.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}
