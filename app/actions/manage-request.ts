'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { classifyBalanceImpact } from '@/lib/vacation-cycle'

const prisma = new PrismaClient()

export async function processRequest(formData: FormData) {
  const requestId = formData.get('requestId') as string
  const action = formData.get('action') as string
  const reason = formData.get('reason') as string

  try {
    const request = await prisma.request.findUnique({ 
        where: { id: requestId },
        select: { 
            type: true, 
            userId: true, 
            daysRequested: true, 
            status: true,
            startDate: true,
            createdAt: true,
            user: { select: { entryDate: true } }
        }
    })

    if (!request) return;

    // GUARD anti doble-clic: solo procesar si está en PENDING_BOSS
    if (request.status !== 'PENDING_BOSS') {
      return;
    }

    // Clasificar el impacto en saldo (solo aplica a VACATION)
    const impact = request.type === 'VACATION'
      ? classifyBalanceImpact(request.startDate, request.createdAt, request.user.entryDate)
      : { subPendingOnApprove: false, addUsedOnApprove: false, refundPendingBeforeBoss: false, refundUsedAfterBoss: false }

    const hasDays = request.type === 'VACATION' && request.daysRequested > 0

    if (action === 'APPROVE') {
      const requiresHRApproval = request.type === 'VACATION' || request.type === 'PERMIT_BIRTHDAY';
      const nextStatus = requiresHRApproval ? 'PENDING_HR' : 'APPROVED';
      const autoApproveHR = !requiresHRApproval; 

      // ============================================================
      // LA FIRMA DEL JEFE MUEVE EL SALDO (RH ya no toca saldos)
      // ============================================================
      await prisma.$transaction(async (tx) => {
        await tx.request.update({
          where: { id: requestId },
          data: {
            status: nextStatus,
            approvedByBoss: true,
            bossApprovalDate: new Date(),
            approvedByHR: autoApproveHR,
            hrApprovalDate: autoApproveHR ? new Date() : null
          }
        })

        if (hasDays && (impact.subPendingOnApprove || impact.addUsedOnApprove)) {
          await tx.vacationBalance.update({
            where: { userId: request.userId },
            data: {
              ...(impact.subPendingOnApprove ? { pendingDays: { decrement: request.daysRequested } } : {}),
              ...(impact.addUsedOnApprove ? { usedDays: { increment: request.daysRequested } } : {}),
            }
          })
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
        ...(hasDays && impact.refundPendingBeforeBoss ? [
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