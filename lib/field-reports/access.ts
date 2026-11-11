import { attendanceActor, fail } from '@/lib/attendance/access'
import { prisma } from '@/lib/prisma'

export async function fieldReportActor() {
  const actor = await attendanceActor()
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { canUploadFieldReports: true } })
  const canUploadFieldReports = !!user?.canUploadFieldReports || ['HR', 'ADMIN'].includes(actor.role)
  if (!canUploadFieldReports) fail('Solo RH, Admin y el responsable autorizado de personal de campo pueden cargar y confirmar estos reportes.')
  return { ...actor, canUploadFieldReports, receivesFieldReportReminders: !!user?.canUploadFieldReports }
}
