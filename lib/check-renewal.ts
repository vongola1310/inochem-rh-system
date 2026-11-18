import { withBalanceTransaction, renewBalanceInTransaction, needsBalanceRenewal } from './vacation-balance'
import { prisma } from './prisma'

export async function checkAndRenewBalance(userId: string) {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { entryDate: true, balance: { select: { lastYearProcessed: true } } } })
  if (!current?.balance || !needsBalanceRenewal(current.entryDate, current.balance.lastYearProcessed)) return false
  // La comprobación transaccional sigue siendo necesaria si el aniversario está pendiente.
  return withBalanceTransaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { entryDate: true } })
    if (!user) return false
    // Las solicitudes anticipadas del nuevo ciclo se conservan al renovar.
    return renewBalanceInTransaction(tx, userId, user.entryDate)
  })
}
