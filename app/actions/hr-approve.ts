
'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// ============================================================
// VISTO BUENO DE RH — CERO MOVIMIENTO DE SALDOS
// El movimiento pendingDays -> usedDays ocurre cuando el JEFE
// firma (manage-request.ts). Aquí solo se registra la validación.
// No importa si RH aprueba semanas después o cruza aniversarios:
// esta función es incapaz de corromper un saldo.
// ============================================================
export async function approveRequestByHR(requestId: string) {
  try {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { status: true }
    })

    if (!request) return { success: false, message: "Solicitud no encontrada" }

    // GUARD anti doble-clic: solo procesar si está en PENDING_HR
    if (request.status !== 'PENDING_HR') {
      return { 
        success: false, 
        message: `Esta solicitud ya fue procesada (estado actual: ${request.status}).` 
      }
    }

    await prisma.request.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedByHR: true,
        hrApprovalDate: new Date(),
      }
    })

    revalidatePath('/')
    return { success: true, message: "Visto bueno registrado." }

  } catch (error) {
    console.error(error)
    return { success: false, message: "Error al procesar" }
  }
}