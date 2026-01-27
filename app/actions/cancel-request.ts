'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function cancelRequest(formData: FormData) {
  const requestId = formData.get('requestId') as string
  
  try {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { user: true }
    })

    if (!request) return { success: false, message: "Solicitud no encontrada" }

    // CASO 1: Aún no se aprueba
    if (request.status === 'PENDING_BOSS' || request.status === 'PENDING_HR') {
      await prisma.$transaction([
        prisma.request.update({
          where: { id: requestId },
          data: { status: 'CANCELLED' }
        }),
        ...(request.type === 'VACATION' && request.daysRequested > 0 ? [
          prisma.vacationBalance.update({
            where: { userId: request.userId },
            data: { pendingDays: { decrement: request.daysRequested } }
          })
        ] : [])
      ])
      
      revalidatePath('/')
      return { success: true, message: "Solicitud cancelada correctamente." }
    }

    // CASO 2: Ya fue aprobada (Solicitar cancelación)
    if (request.status === 'APPROVED') {
      await prisma.request.update({
        where: { id: requestId },
        data: { status: 'CANCELLATION_REQUESTED' }
      })
      
      revalidatePath('/')
      return { success: true, message: "Se envió la petición de cancelación." }
    }

    return { success: false, message: "No se puede cancelar esta solicitud." }

  } catch (error) {
    return { success: false, message: "Error al procesar cancelación." }
  }
}

export async function approveCancellation(formData: FormData) {
    const requestId = formData.get('requestId') as string
    
    const request = await prisma.request.findUnique({ where: { id: requestId } })
    if (!request) return

    await prisma.$transaction([
        prisma.request.update({
            where: { id: requestId },
            data: { status: 'CANCELLED' }
        }),
        ...(request.type === 'VACATION' && request.daysRequested > 0 ? [
            prisma.vacationBalance.update({
                where: { userId: request.userId },
                data: { usedDays: { decrement: request.daysRequested } }
            })
        ] : [])
    ])
    
    revalidatePath('/')
}