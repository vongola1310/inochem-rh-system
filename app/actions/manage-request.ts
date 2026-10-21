'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { transitionRequest } from '@/lib/request-transition'

export async function processRequest(formData: FormData) {
  const requestId = formData.get('requestId') as string
  const action = formData.get('action') as string
  const reason = formData.get('reason') as string
  if (!requestId || !['APPROVE', 'REJECT'].includes(action)) return
  const request = await prisma.request.findUnique({ where: { id: requestId }, select: { type: true } })
  if (!request) return

  if (action === 'APPROVE') {
    const needsHR = request.type === 'VACATION' || request.type === 'PERMIT_BIRTHDAY'
    await transitionRequest(requestId, ['PENDING_BOSS'], needsHR ? 'PENDING_HR' : 'APPROVED', {
      approvedByBoss: true, bossApprovalDate: new Date(),
      approvedByHR: !needsHR, hrApprovalDate: needsHR ? null : new Date(),
    })
  } else {
    await transitionRequest(requestId, ['PENDING_BOSS'], 'REJECTED', { rejectionReason: reason })
  }
  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath('/team/history')
  revalidatePath(`/dashboard/requests/${requestId}`)
  redirect('/')
}
