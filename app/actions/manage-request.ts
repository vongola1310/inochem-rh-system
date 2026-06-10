'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const prisma = new PrismaClient()

export async function processRequest(formData: FormData) {
  const requestId = formData.get('requestId') as string
  const action = formData.get('action') as string
  const reason = formData.get('reason') as string

  try {
    // 1. Buscamos la solicitud con su estado actual
    const request = await prisma.request.findUnique({ 
        where: { id: requestId },
        select: { type: true, userId: true, daysRequested: true, status: true }
    })

    if (!request) return;

    // ============================================================
    // GUARD: Solo procesar si está en PENDING_BOSS
    // Evita doble clic, recargas, o llamadas duplicadas
    // ============================================================
    if (request.status !== 'PENDING_BOSS') {
      return;
    }

    if (action === 'APPROVE') {
      const requiresHRApproval = request.type === 'VACATION' || request.type === 'PERMIT_BIRTHDAY';
      const nextStatus = requiresHRApproval ? 'PENDING_HR' : 'APPROVED';
      const autoApproveHR = !requiresHRApproval; 

      await prisma.request.update({
        where: { id: requestId },
        data: {
          status: nextStatus,
          approvedByBoss: true,
          bossApprovalDate: new Date(),
          approvedByHR: autoApproveHR,
          hrApprovalDate: autoApproveHR ? new Date() : null
        }
      })

    } else {
      // --- RECHAZO ---
      await prisma.$transaction([
        prisma.request.update({
          where: { id: requestId },
          data: {
            status: 'REJECTED',
            rejectionReason: reason,
          }
        }),
        // Solo devolver pendingDays si es VACACIÓN
        // Los permisos nunca sumaron pendingDays, así que no hay nada que devolver
        ...(request.type === 'VACATION' && request.daysRequested > 0 ? [
          prisma.vacationBalance.update({
            where: { userId: request.userId },
            data: { pendingDays: { decrement: request.daysRequested } }
          })
        ] : [])
      ])
    }
    
    revalidatePath('/')

  } catch (error) {
    console.error("Error al procesar la solicitud:", error)
    throw error; 
  }

  redirect('/')
}