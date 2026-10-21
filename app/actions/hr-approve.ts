'use server'

import { revalidatePath } from 'next/cache'
import { transitionRequest } from '@/lib/request-transition'

export async function approveRequestByHR(requestId: string) {
  try {
    // PENDING_HR y APPROVED ya cuentan como aprobados por jefe: delta de saldo = 0.
    const changed = await transitionRequest(requestId, ['PENDING_HR'], 'APPROVED', {
      approvedByHR: true, hrApprovalDate: new Date(),
    })
    if (!changed) return { success: false, message: 'La solicitud no existe o ya fue procesada.' }
    revalidatePath('/')
    revalidatePath('/admin')
    revalidatePath('/team/history')
    revalidatePath(`/dashboard/requests/${requestId}`)
    return { success: true, message: 'Visto bueno registrado.' }
  } catch (error) {
    console.error('Error al registrar el visto bueno de RH:', error)
    return { success: false, message: 'Error al procesar' }
  }
}
