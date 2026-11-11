'use server'

import { revalidatePath } from 'next/cache'
import { attendanceActor, actionError, fail } from '@/lib/attendance/access'
import { attendanceTransaction } from '@/lib/attendance/service'

export async function setEmployeeBlacklist(form: FormData) {
  try {
    const actor = await attendanceActor(['HR'])
    const id = String(form.get('userId') || '')
    const value = form.get('blacklisted')
    if (value !== 'true' && value !== 'false') fail('Selecciona un estado válido.')
    const isBlacklisted = value === 'true'
    if (id === actor.id) fail('No puedes enviar tu propia cuenta a la lista negra.')
    await attendanceTransaction(async tx => {
      const user = await tx.user.findUnique({ where: { id }, select: { id: true, isBlacklisted: true } })
      if (!user) fail('El colaborador no existe.')
      if (user.isBlacklisted === isBlacklisted) fail('El estado ya cambió. Actualiza la página.')
      const updated = await tx.user.updateMany({ where: { id, isBlacklisted: !isBlacklisted }, data: { isBlacklisted, blacklistedAt: isBlacklisted ? new Date() : null } })
      if (updated.count !== 1) fail('El estado ya cambió. Actualiza la página.')
      await tx.attendanceImport.updateMany({ where: { status: { in: ['PUBLISHED', 'CLOSED'] }, days: { some: { OR: [{ userId: id }, { managerId: id }] } } }, data: { needsRefresh: true } })
      await tx.attendanceEvent.create({ data: { actorId: actor.id, action: isBlacklisted ? 'EMPLOYEE_BLACKLISTED' : 'EMPLOYEE_RESTORED', details: { userId: id, before: user.isBlacklisted, after: isBlacklisted } } })
    })
    revalidatePath('/admin/users'); revalidatePath('/admin/employees/' + id)
    revalidatePath('/admin/attendance', 'layout'); revalidatePath('/attendance'); revalidatePath('/')
    return { success: true, message: isBlacklisted ? 'Colaborador en lista negra. Se conserva su historial y queda excluido de incidencias y reportes.' : 'Colaborador restaurado. Actualiza los periodos afectados para recalcular el reporte.' }
  } catch (error) { return { success: false, message: actionError(error) } }
}
