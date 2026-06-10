'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

export async function approveRequestByHR(requestId: string) {
  try {
    // 1. Obtener la solicitud CON su estado actual
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { 
        daysRequested: true, 
        userId: true,
        type: true,
        status: true  // CRÍTICO: verificar estado antes de actuar
      }
    })

    if (!request) return { success: false, message: "Solicitud no encontrada" }

    // ============================================================
    // GUARD: Solo procesar si está en PENDING_HR
    // Evita doble clic, recargas de página, o llamadas duplicadas
    // ============================================================
    if (request.status !== 'PENDING_HR') {
      return { 
        success: false, 
        message: `Esta solicitud ya fue procesada (estado actual: ${request.status}).` 
      }
    }

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

      // B) MOVIMIENTO DE SALDOS
      // Solo si es VACACIÓN (los permisos no manejan pendingDays)
      if (request.type === 'VACATION' && request.daysRequested > 0) {
        await tx.vacationBalance.update({
          where: { userId: request.userId },
          data: {
            pendingDays: { decrement: request.daysRequested },
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