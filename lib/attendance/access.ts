import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export class AttendanceError extends Error {}
export function fail(message: string): never { throw new AttendanceError(message) }

export async function attendanceActor(roles?: string[]) {
  const session = await auth()
  if (!session?.user?.id) fail('Inicia sesión para continuar.')
  const actor = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, role: true, isBlacklisted: true } })
  if (!actor || actor.isBlacklisted || (roles && !roles.includes(actor.role))) fail('No tienes permiso para realizar esta operación.')
  return actor
}

export function actionError(error: unknown): string {
  if (error instanceof AttendanceError) return error.message
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'P2002') return 'Este periodo, empleado/fecha o folio ya está registrado. Actualiza la página para revisarlo.'
    if (error.code === 'P2021' || error.code === 'P2022') return 'El módulo requiere activar su migración de base de datos.'
    if (error.code === 'P2034') return 'Hubo una actualización simultánea. Actualiza la página e inténtalo de nuevo.'
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo.'
}
