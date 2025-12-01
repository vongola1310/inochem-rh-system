'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'

const prisma = new PrismaClient()

export async function setBackupBoss(formData: FormData) {
  const session = await auth()
  if (!session?.user?.email) return { success: false, message: "No autorizado" }

  const backupId = formData.get('backupId') as string
  const startDateStr = formData.get('startDate') as string
  const endDateStr = formData.get('endDate') as string

  // Si seleccionó "Nadie" (limpiar respaldo)
  if (backupId === 'none' || !backupId) {
    await prisma.user.update({
        where: { email: session.user.email },
        data: { 
            backupId: null,
            backupStartDate: null,
            backupEndDate: null
        }
    })
    revalidatePath('/')
    return { success: true, message: "Delegación desactivada. Ahora tú recibes las solicitudes." }
  }

  // Si seleccionó a alguien, guardamos fechas y ID
  try {
    // Ajuste de zona horaria simple (Mediodía UTC) para evitar desfases
    const start = new Date(startDateStr + 'T12:00:00Z')
    const end = new Date(endDateStr + 'T12:00:00Z')

    await prisma.user.update({
        where: { email: session.user.email },
        data: {
            backupId: backupId,
            backupStartDate: start,
            backupEndDate: end
        }
    })

    revalidatePath('/')
    return { success: true, message: "Jefe de respaldo asignado correctamente." }
  } catch (error) {
    return { success: false, message: "Error al guardar la configuración." }
  }
}