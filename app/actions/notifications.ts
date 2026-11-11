// app/actions/notifications.ts
'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { ensureFieldReportReminder } from '@/lib/field-reports/reminders'

const prisma = new PrismaClient()

// 1. Obtener notificaciones no leídas
export async function getUnreadNotifications(userId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.id !== userId) return { success: false, data: [] }
    await ensureFieldReportReminder(userId)
    const notifications = await prisma.notification.findMany({
      where: {
        userId: userId,
        isRead: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    })
    return { success: true, data: notifications }
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return { success: false, data: [] }
  }
}

// 2. Marcar como leída
export async function markNotificationAsRead(notificationId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false }
    await prisma.notification.updateMany({
      where: { id: notificationId, userId: session.user.id },
      data: { isRead: true },
    })
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    return { success: false }
  }
}
