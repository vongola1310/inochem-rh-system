import { withBalanceTransaction, renewBalanceInTransaction } from './vacation-balance'

export async function checkAndRenewBalance(userId: string) {
  return withBalanceTransaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { entryDate: true } })
    if (!user) return false
    // Las solicitudes anticipadas del nuevo ciclo se conservan al renovar.
    return renewBalanceInTransaction(tx, userId, user.entryDate)
  })
}
