'use server'

import { revalidatePath } from 'next/cache'
import { attendanceActor, actionError, fail } from '@/lib/attendance/access'
import { attendanceTransaction, checkVersion } from '@/lib/attendance/service'
import { dateKey } from '@/lib/attendance/dates'

export async function deleteAttendancePeriod(form: FormData) {
  try {
    const actor = await attendanceActor(['HR', 'ADMIN'])
    const id = String(form.get('importId') || ''), version = checkVersion(form.get('version'))
    if (form.get('confirmation') !== 'ELIMINAR') fail('Escribe ELIMINAR para confirmar el borrado de este periodo.')
    await attendanceTransaction(async tx => {
      const batch = await tx.attendanceImport.findUnique({ where: { id }, include: { _count: { select: { days: true } } } })
      if (!batch || batch.version !== version) fail('El periodo cambió o ya fue eliminado. Actualiza la página.')
      const links = [`/attendance?period=${id}`, `/attendance?view=team&period=${id}`, `/admin/attendance/${id}`]
      await tx.notification.deleteMany({ where: { link: { in: links } } })
      await tx.attendanceEvent.deleteMany({ where: { OR: [{ importId: id }, { day: { importId: id } }] } })
      await tx.attendanceDay.deleteMany({ where: { importId: id } })
      await tx.attendanceImport.delete({ where: { id, version } })
      await tx.attendanceEvent.create({ data: { actorId: actor.id, action: 'ATTENDANCE_PERIOD_DELETED', details: {
        deletedImportId: id, startDate: dateKey(batch.startDate), endDate: dateKey(batch.endDate), status: batch.status,
        sourceDigest: batch.sourceDigest, deletedDays: batch._count.days,
      } } })
    })
    revalidatePath('/admin/attendance', 'layout'); revalidatePath('/attendance'); revalidatePath('/')
    return { success: true, message: 'Periodo eliminado, junto con sus incidencias y avisos. Los acumulados ya no incluyen estos registros.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}
