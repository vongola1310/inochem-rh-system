'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { classifyBalanceImpact } from '@/lib/vacation-cycle'

const prisma = new PrismaClient()

export async function cancelRequest(formData: FormData) {
  const requestId = formData.get('requestId') as string
  
  try {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { user: true }
    })

    if (!request) return { success: false, message: "Solicitud no encontrada" }

    const hasDays = request.type === 'VACATION' && request.daysRequested > 0
    const impact = request.type === 'VACATION'
      ? classifyBalanceImpact(request.startDate, request.createdAt, request.user.entryDate)
      : { subPendingOnApprove: false, addUsedOnApprove: false, refundPendingBeforeBoss: false, refundUsedAfterBoss: false }

    // ============================================================
    // CASO 1a: PENDING_BOSS — el jefe aún NO firma.
    // El pending se devuelve solo si sigue vivo (no lo borró un aniversario).
    // ============================================================
    if (request.status === 'PENDING_BOSS') {
      await prisma.$transaction([
        prisma.request.update({
          where: { id: requestId },
          data: { status: 'CANCELLED' }
        }),
        ...(hasDays && impact.refundPendingBeforeBoss ? [
          prisma.vacationBalance.update({
            where: { userId: request.userId },
            data: { pendingDays: { decrement: request.daysRequested } }
          })
        ] : [])
      ])
      
      revalidatePath('/')
      return { success: true, message: "Solicitud cancelada correctamente." }
    }

    // ============================================================
    // CASO 1b: PENDING_HR — el jefe YA firmó (used ya se movió).
    // Se devuelve usedDays solo si esta solicitud lo sumó en el ciclo actual.
    // ============================================================
    if (request.status === 'PENDING_HR') {
      await prisma.$transaction([
        prisma.request.update({
          where: { id: requestId },
          data: { status: 'CANCELLED' }
        }),
        ...(hasDays && impact.refundUsedAfterBoss ? [
          prisma.vacationBalance.update({
            where: { userId: request.userId },
            data: { usedDays: { decrement: request.daysRequested } }
          })
        ] : [])
      ])
      
      revalidatePath('/')
      return { success: true, message: "Solicitud cancelada y días devueltos." }
    }

    // ============================================================
    // CASO 2: Ya con visto bueno completo → pedir cancelación a RH
    // ============================================================
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
    
    const request = await prisma.request.findUnique({ 
        where: { id: requestId },
        include: { user: true }
    })
    if (!request) return

    // GUARD anti doble-clic: solo procesar si está en CANCELLATION_REQUESTED
    if (request.status !== 'CANCELLATION_REQUESTED') return

    const hasDays = request.type === 'VACATION' && request.daysRequested > 0
    const impact = request.type === 'VACATION'
      ? classifyBalanceImpact(request.startDate, request.createdAt, request.user.entryDate)
      : { subPendingOnApprove: false, addUsedOnApprove: false, refundPendingBeforeBoss: false, refundUsedAfterBoss: false }

    await prisma.$transaction([
        prisma.request.update({
            where: { id: requestId },
            data: { status: 'CANCELLED' }
        }),
        ...(hasDays && impact.refundUsedAfterBoss ? [
            prisma.vacationBalance.update({
                where: { userId: request.userId },
                data: { usedDays: { decrement: request.daysRequested } }
            })
        ] : [])
    ])
    
    revalidatePath('/')
}