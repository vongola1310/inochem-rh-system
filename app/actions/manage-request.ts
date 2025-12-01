'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const prisma = new PrismaClient()

export async function processRequest(formData: FormData) {
  const requestId = formData.get('requestId') as string
  const action = formData.get('action') as string // 'APPROVE' o 'REJECT'
  const reason = formData.get('reason') as string // Solo si rechaza

  try {
    // 1. Buscamos la solicitud para saber de qué TIPO es
    const request = await prisma.request.findUnique({ 
        where: { id: requestId },
        select: { type: true, userId: true, daysRequested: true }
    })

    if (!request) return;

    if (action === 'APPROVE') {
      // --- LÓGICA DIFERENCIADA POR TIPO ---
      
      // REGLA DE NEGOCIO ACTUALIZADA:
      // Requieren aprobación de RH (Doble paso): VACACIONES y CUMPLEAÑOS.
      // Aprobación directa (Solo Jefe): Llegar tarde, Salir temprano, Ausencia, Otros.
      const requiresHRApproval = request.type === 'VACATION' || request.type === 'PERMIT_BIRTHDAY';
      
      // Si requiere RH, pasa a PENDING_HR. Si no, pasa directo a APPROVED.
      const nextStatus = requiresHRApproval ? 'PENDING_HR' : 'APPROVED';

      // Si NO requiere RH (es permiso simple), autocompletamos la firma de RH para cerrar el ciclo.
      const autoApproveHR = !requiresHRApproval; 

      await prisma.request.update({
        where: { id: requestId },
        data: {
          status: nextStatus,
          approvedByBoss: true,
          bossApprovalDate: new Date(),
          
          // Lógica de autocompletado para RH
          approvedByHR: autoApproveHR,
          hrApprovalDate: autoApproveHR ? new Date() : null
        }
      })

    } else {
      // --- RECHAZO (IGUAL PARA TODOS) ---
      // Se cancela y se regresan los días al saldo si aplica
      await prisma.$transaction([
        prisma.request.update({
          where: { id: requestId },
          data: {
            status: 'REJECTED',
            rejectionReason: reason,
          }
        }),
        // Devolver los días solo si se habían descontado (generalmente Vacaciones)
        prisma.vacationBalance.update({
          where: { userId: request.userId },
          data: { pendingDays: { decrement: request.daysRequested || 0 } }
        })
      ])
    }
    
    revalidatePath('/')

  } catch (error) {
    console.error("Error al procesar la solicitud:", error)
    throw error; 
  }

  redirect('/')
}