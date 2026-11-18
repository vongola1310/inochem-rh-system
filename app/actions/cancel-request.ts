'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { transitionRequest } from '@/lib/request-transition'
import { attendanceActor } from '@/lib/attendance/access'

function refreshRequest(requestId: string) {
  for (const path of ['/', '/admin', '/team/history', '/vacations/cancellations', `/dashboard/requests/${requestId}`]) revalidatePath(path)
  revalidatePath('/admin/attendance', 'layout')
}
const audit = (action: string, actorName: string, reason: string) => `\n\n[${new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' }).format(new Date())} · ${action} · ${actorName}]\n${reason}`

export async function cancelRequest(formData: FormData) {
  try {
    const actor = await attendanceActor()
    const requestId = String(formData.get('requestId') || '')
    const reason = String(formData.get('reason') || '').trim()
    const request = await prisma.request.findUnique({ where: { id: requestId }, select: { status: true, userId: true, type: true, user: { select: { name: true, bossId: true } } } })
    if (!request || request.userId !== actor.id) return { success: false, message: 'Solo puedes cancelar tus propias solicitudes.' }
    if (request.type === 'VACATION' && (reason.length < 5 || reason.length > 1000)) return { success: false, message: 'Escribe el motivo de cancelación (entre 5 y 1,000 caracteres).' }
    if (!['PENDING_BOSS', 'PENDING_HR', 'APPROVED'].includes(request.status)) return { success: false, message: 'Esta solicitud ya fue procesada o está en revisión de cancelación.' }
    const review = request.status === 'APPROVED'
    const recipients = await prisma.user.findMany({ where: { isBlacklisted: false, OR: [{ role: 'HR' }, ...(request.user.bossId ? [{ id: request.user.bossId }] : [])] }, select: { id: true, role: true } })
    const title = review ? 'Cancelación por revisar' : 'Solicitud cancelada'
    const notifications = recipients.filter(user => user.id !== actor.id).map(user => ({ userId: user.id, title,
      message: `${request.user.name} ${review ? 'solicitó una cancelación. RH debe revisar la petición.' : 'canceló una solicitud pendiente.'}`,
      link: user.role === 'HR' && request.type === 'VACATION' ? '/vacations/cancellations?view=review' : `/dashboard/requests/${requestId}`,
    }))
    const changed = await transitionRequest(requestId, [request.status], review ? 'CANCELLATION_REQUESTED' : 'CANCELLED', {}, audit(review ? 'Cancelación solicitada' : 'Solicitud cancelada', actor.name, reason || 'Cancelada por el titular.'), notifications)
    if (!changed) return { success: false, message: 'La solicitud cambió de estado. Actualiza la página.' }
    refreshRequest(requestId)
    return { success: true, message: review ? 'Petición enviada a RH. Los días se mantienen comprometidos hasta que RH confirme la cancelación.' : 'Solicitud cancelada. El saldo se actualizó en el ciclo correspondiente.' }
  } catch {
    return { success: false, message: 'No se pudo cancelar la solicitud. Revisa tu sesión e inténtalo de nuevo.' }
  }
}

async function resolveCancellation(formData: FormData, approve: boolean) {
  try {
    const actor = await attendanceActor(['HR'])
    const requestId = String(formData.get('requestId') || '')
    const reason = String(formData.get('reason') || '').trim()
    if ((!approve && reason.length < 5) || reason.length > 1000) return { success: false, message: 'Escribe el motivo de la decisión (entre 5 y 1,000 caracteres).' }
    const request = await prisma.request.findUnique({ where: { id: requestId }, select: { userId: true, user: { select: { bossId: true } } } })
    if (!request) return { success: false, message: 'Solicitud no encontrada.' }
    const recipients = await prisma.user.findMany({ where: { id: { in: [request.userId, ...(request.user.bossId ? [request.user.bossId] : [])] }, isBlacklisted: false }, select: { id: true } })
    const changed = await transitionRequest(requestId, ['CANCELLATION_REQUESTED'], approve ? 'CANCELLED' : 'APPROVED', {},
      audit(approve ? 'Cancelación autorizada por RH' : 'Cancelación rechazada por RH', actor.name, reason || 'RH confirmó la cancelación.'),
      recipients.map(user => ({ userId: user.id, title: approve ? 'Cancelación autorizada' : 'Cancelación rechazada', message: approve ? 'RH confirmó la cancelación. Se actualizó el saldo en el ciclo correspondiente.' : 'RH rechazó la cancelación. La solicitud original continúa aprobada.', link: `/dashboard/requests/${requestId}` })))
    if (!changed) return { success: false, message: 'La cancelación ya fue resuelta. Actualiza la página.' }
    refreshRequest(requestId)
    return { success: true, message: approve ? 'Cancelación confirmada y saldo actualizado.' : 'Cancelación rechazada. Las vacaciones continúan aprobadas.' }
  } catch { return { success: false, message: 'No se pudo resolver la cancelación. Solo RH puede realizar esta acción.' } }
}

export async function approveCancellation(formData: FormData) { return resolveCancellation(formData, true) }
export async function rejectCancellation(formData: FormData) { return resolveCancellation(formData, false) }

export async function withdrawCancellation(formData: FormData) {
  try {
    const actor = await attendanceActor()
    const requestId = String(formData.get('requestId') || '')
    const request = await prisma.request.findUnique({ where: { id: requestId }, select: { userId: true, type: true, status: true, user: { select: { bossId: true } } } })
    if (!request || request.userId !== actor.id || request.type !== 'VACATION') return { success: false, message: 'Solo puedes retirar la petición de tus propias vacaciones.' }
    if (request.status !== 'CANCELLATION_REQUESTED') return { success: false, message: 'La petición ya fue resuelta. Actualiza la página; si RH ya canceló las vacaciones, solicita su revisión.' }
    const recipients = await prisma.user.findMany({ where: { isBlacklisted: false, OR: [{ role: 'HR' }, ...(request.user.bossId ? [{ id: request.user.bossId }] : [])] }, select: { id: true } })
    const changed = await transitionRequest(requestId, ['CANCELLATION_REQUESTED'], 'APPROVED', {},
      audit('Petición de cancelación retirada por el titular', actor.name, 'Sí disfruté las vacaciones. Retiro mi petición de cancelación y conservo los días descontados.'),
      recipients.filter(user => user.id !== actor.id).map(user => ({ userId: user.id, title: 'Petición de cancelación retirada', message: `${actor.name} retiró su petición porque sí disfrutó las vacaciones. Permanecen aprobadas y los días siguen descontados.`, link: `/dashboard/requests/${requestId}` })))
    if (!changed) return { success: false, message: 'La petición cambió de estado. Actualiza la página antes de continuar.' }
    refreshRequest(requestId)
    return { success: true, message: 'Retiraste la petición de cancelación. Tus vacaciones quedan aprobadas y los días siguen descontados.' }
  } catch { return { success: false, message: 'No se pudo retirar la petición. Revisa tu sesión e inténtalo de nuevo.' } }
}
