import type { Prisma, RequestStatus } from '@prisma/client'
import { withBalanceTransaction, renewBalanceInTransaction, getCycleUsage } from './vacation-balance'
import { getCycleBounds } from './vacation-cycle'
import { calculateVacationUsage } from './vacation-usage'

type TransitionData = Pick<Prisma.RequestUpdateManyMutationInput,
  'approvedByBoss' | 'bossApprovalDate' | 'approvedByHR' | 'hrApprovalDate' | 'rejectionReason'>

/** Firma, rechazo y cancelación cambian estado y saldo en la misma transacción. */
export async function transitionRequest(
  requestId: string,
  expectedStatuses: RequestStatus[],
  nextStatus: RequestStatus,
  data: TransitionData = {},
  observationSuffix?: string,
) {
  return withBalanceTransaction(async tx => {
    const request = await tx.request.findUnique({
      where: { id: requestId },
      select: { id: true, userId: true, type: true, status: true, startDate: true, daysRequested: true,
        observations: true, user: { select: { entryDate: true } } },
    })
    if (!request || !expectedStatuses.includes(request.status)) return false
    const asOf = new Date()
    if (request.type === 'VACATION') {
      await renewBalanceInTransaction(tx, request.userId, request.user.entryDate, asOf)
    }
    const changed = await tx.request.updateMany({
      where: { id: requestId, status: request.status },
      data: { ...data, status: nextStatus,
        ...(observationSuffix ? { observations: (request.observations || '') + observationSuffix } : {}),
      },
    })
    if (changed.count === 0) return false
    if (request.type === 'VACATION') {
      const { cycleStart, cycleEnd } = getCycleBounds(request.user.entryDate, asOf)
      const before = calculateVacationUsage([request], cycleStart, cycleEnd)
      const after = calculateVacationUsage([{ ...request, status: nextStatus }], cycleStart, cycleEnd)
      // RH no descuenta otra vez. El delta preserva días usados ajustados manualmente.
      const usedDelta = after.usedDays - before.usedDays
      const { pendingDays } = await getCycleUsage(tx, request.userId, request.user.entryDate, asOf)
      await tx.vacationBalance.update({
        where: { userId: request.userId },
        data: { pendingDays, ...(usedDelta ? { usedDays: { increment: usedDelta } } : {}), lastUpdated: asOf },
      })
    }
    return true
  })
}
