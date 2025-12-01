'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function approveRequestByHR(requestId: string) {
  try {
    // 1. Obtener la solicitud para saber cuántos días mover
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { 
        daysRequested: true, 
        userId: true,
        type: true 
      }
    })

    if (!request) return { success: false, message: "Solicitud no encontrada" }

    // 2. Transacción: Actualizar Estado Y Mover Saldos
    await prisma.$transaction(async (tx) => {
      
      // A) Cambiar estado a APROBADO
      await tx.request.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedByHR: true,
          hrApprovalDate: new Date(),
        }
      })

      // B) MOVIMIENTO DE SALDOS (CRÍTICO)
      // Solo si es VACACIÓN (porque solo las vacaciones congelan saldo en 'pendingDays')
      if (request.type === 'VACATION' && request.daysRequested > 0) {
        await tx.vacationBalance.update({
          where: { userId: request.userId },
          data: {
            // Restamos de "Por Autorizar"
            pendingDays: { decrement: request.daysRequested },
            // Sumamos a "Ya Disfrutados"
            usedDays: { increment: request.daysRequested }
          }
        })
      }
    })

    revalidatePath('/')
    return { success: true, message: "Vacaciones procesadas y saldo actualizado." }

  } catch (error) {
    console.error(error)
    return { success: false, message: "Error al procesar" }
  }
}