'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { transitionRequest } from '@/lib/request-transition'
import { auth } from '@/auth'
import { dateKey, todayInMexico } from '@/lib/attendance/dates'

export async function processRequest(formData: FormData) {
  const requestId = formData.get('requestId') as string
  const action = formData.get('action') as string
  const reason = formData.get('reason') as string
  if (!requestId || !['APPROVE', 'REJECT'].includes(action)) return
  const session = await auth()
  if (!session?.user?.id) return
  const request = await prisma.request.findUnique({ where: { id: requestId }, select: { type: true, userId: true,
    user: { select: { bossId: true, boss: { select: { backupId: true, backupStartDate: true, backupEndDate: true } } } } } })
  if (!request) return
  const boss = request.user.boss, today = todayInMexico()
  const isBackup = boss?.backupId === session.user.id && boss.backupStartDate && boss.backupEndDate && today >= dateKey(boss.backupStartDate) && today <= dateKey(boss.backupEndDate)
  if (request.userId === session.user.id || (request.user.bossId !== session.user.id && !isBackup)) return

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
