import { auth } from '@/auth'
import { prisma } from './prisma'

/** El directorio de personal es administrado por RH. Comprueba el rol vigente, no solo el JWT. */
export async function canManageEmployees() {
  const session = await auth()
  if (!session?.user?.id) return false
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  return actor?.role === 'HR'
}
