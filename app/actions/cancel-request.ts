'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { transitionRequest } from '@/lib/request-transition'
import { auth } from '@/auth'
import { canManageEmployees } from '@/lib/employee-access'

function refreshRequest(requestId: string) {
  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/team/history')
  revalidatePath(`/dashboard/requests/${requestId}`)
}

export async function cancelRequest(formData: FormData) {
  const requestId = formData.get('requestId') as string
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, message: 'Inicia sesión para continuar.' }
    const request = await prisma.request.findUnique({ where: { id: requestId }, select: { status: true, userId: true } })
    if (!request) return { success: false, message: 'Solicitud no encontrada' }
    if (request.userId !== session.user.id) return { success: false, message: 'Solo puedes cancelar tus propias solicitudes.' }
    if (request.status === 'PENDING_BOSS' || request.status === 'PENDING_HR') {
      const changed = await transitionRequest(requestId, [request.status], 'CANCELLED')
      if (!changed) return { success: false, message: 'La solicitud cambió de estado. Actualiza la página.' }
      refreshRequest(requestId)
      return { success: true, message: 'Solicitud cancelada y saldo actualizado.' }
    }
    if (request.status === 'APPROVED') {
      const changed = await transitionRequest(requestId, ['APPROVED'], 'CANCELLATION_REQUESTED')
      if (!changed) return { success: false, message: 'La solicitud ya fue procesada.' }
      refreshRequest(requestId)
      return { success: true, message: 'Se envió la petición de cancelación.' }
    }
    return { success: false, message: 'No se puede cancelar esta solicitud.' }
  } catch (error) {
    console.error('Error al cancelar solicitud:', error)
    return { success: false, message: 'Error al procesar cancelación.' }
  }
}

export async function approveCancellation(formData: FormData) {
  if (!await canManageEmployees()) return
  const requestId = formData.get('requestId') as string
  await transitionRequest(requestId, ['CANCELLATION_REQUESTED'], 'CANCELLED')
  refreshRequest(requestId)
}
