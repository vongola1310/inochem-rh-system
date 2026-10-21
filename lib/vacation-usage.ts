import type { RequestStatus } from '@prisma/client'

export type VacationUsageRequest = {
  startDate: Date
  daysRequested: number
  status: RequestStatus
}

/** Solo vacaciones. La fecha de inicio asigna el ciclo; creación y firma no lo cambian. */
export function calculateVacationUsage(requests: VacationUsageRequest[], cycleStart: Date, cycleEnd: Date) {
  let pendingDays = 0
  let usedDays = 0
  let pendingHRDays = 0
  for (const request of requests) {
    if (request.startDate < cycleStart || request.startDate >= cycleEnd) continue
    if (request.daysRequested <= 0) continue
    if (request.status === 'PENDING_BOSS') pendingDays += request.daysRequested
    // Una cancelación solicitada sigue reservando los días hasta que RH la autorice.
    if (['PENDING_HR', 'APPROVED', 'CANCELLATION_REQUESTED'].includes(request.status)) {
      usedDays += request.daysRequested
    }
    if (request.status === 'PENDING_HR') pendingHRDays += request.daysRequested
  }
  return { usedDays, pendingDays, pendingHRDays }
}
