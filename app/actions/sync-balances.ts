'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { checkAndRenewBalance } from '@/lib/check-renewal'

export async function syncAllBalances(formData?: FormData) {
  try {
    const users = await prisma.user.findMany({ select: { id: true } })
    let updatedCount = 0
    for (const user of users) {
      if (await checkAndRenewBalance(user.id)) updatedCount++
    }
    revalidatePath('/')
    revalidatePath('/admin/users')
    revalidatePath('/team/history')
    return { success: true, message: `Sincronización completada. ${updatedCount} ciclos renovados.` }
  } catch (error) {
    console.error('Error al sincronizar saldos:', error)
    return { success: false, message: 'Error al sincronizar.' }
  }
}
