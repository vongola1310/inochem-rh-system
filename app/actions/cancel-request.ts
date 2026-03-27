'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { setYear, addYears, isBefore, startOfDay } from 'date-fns'

const prisma = new PrismaClient()

// Helper: ¿La solicitud pertenece al periodo futuro (post-aniversario)?
// Si es así, nunca se tocó el saldo actual al crearla, así que no debemos tocarlo al cancelar.
function isFuturePeriodRequest(startDate: Date, entryDate: Date): boolean {
    const today = startOfDay(new Date())
    const entry = new Date(entryDate)
    
    // Calcular el próximo aniversario
    let anniversary = new Date(Date.UTC(
        today.getFullYear(),
        entry.getUTCMonth(),
        entry.getUTCDate()
    ))
    
    // Si el aniversario de este año ya pasó, el próximo es el del año siguiente
    if (isBefore(anniversary, today)) {
        anniversary = new Date(Date.UTC(
            today.getFullYear() + 1,
            entry.getUTCMonth(),
            entry.getUTCDate()
        ))
    }

    // Si la solicitud inicia en o después del aniversario, es del periodo futuro
    const requestStart = startOfDay(new Date(startDate))
    return requestStart >= anniversary
}

export async function cancelRequest(formData: FormData) {
  const requestId = formData.get('requestId') as string
  
  try {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { user: true }
    })

    if (!request) return { success: false, message: "Solicitud no encontrada" }

    // ¿Es del periodo futuro? Si es así, NO tocamos el saldo actual
    const isFuture = request.type === 'VACATION' && isFuturePeriodRequest(request.startDate, request.user.entryDate)

    // CASO 1: Aún no se aprueba (PENDING_BOSS o PENDING_HR)
    if (request.status === 'PENDING_BOSS' || request.status === 'PENDING_HR') {
      await prisma.$transaction([
        prisma.request.update({
          where: { id: requestId },
          data: { status: 'CANCELLED' }
        }),
        // Solo devolvemos pendingDays si es vacación del periodo ACTUAL
        // Las del periodo futuro se crearon con updateBalance = false, no hay nada que devolver
        ...(request.type === 'VACATION' && request.daysRequested > 0 && !isFuture ? [
          prisma.vacationBalance.update({
            where: { userId: request.userId },
            data: { pendingDays: { decrement: request.daysRequested } }
          })
        ] : [])
      ])
      
      revalidatePath('/')
      return { success: true, message: "Solicitud cancelada correctamente." }
    }

    // CASO 2: Ya fue aprobada (Solicitar cancelación a RH)
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

    // ¿Es del periodo futuro?
    const isFuture = request.type === 'VACATION' && isFuturePeriodRequest(request.startDate, request.user.entryDate)

    await prisma.$transaction([
        prisma.request.update({
            where: { id: requestId },
            data: { status: 'CANCELLED' }
        }),
        // Solo devolvemos usedDays si es vacación del periodo ACTUAL
        // Las del periodo futuro nunca descontaron del saldo actual
        ...(request.type === 'VACATION' && request.daysRequested > 0 && !isFuture ? [
            prisma.vacationBalance.update({
                where: { userId: request.userId },
                data: { usedDays: { decrement: request.daysRequested } }
            })
        ] : [])
    ])
    
    revalidatePath('/')
}