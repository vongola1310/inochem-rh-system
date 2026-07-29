// lib/vacation-cycle.ts
// ============================================================
// CLASIFICADOR ÚNICO DE SOLICITUDES POR CICLO
// Una sola fuente de verdad para decidir si una solicitud
// toca el saldo al aprobarse, rechazarse o cancelarse.
//
// Regla de oro del sistema:
//   - pendingDays se suma SOLO al crear una solicitud cuyo
//     startDate cae en el ciclo vigente en ese momento.
//   - usedDays se suma cuando el JEFE firma (nuevo flujo).
//   - El visto bueno de RH nunca toca saldos.
//   - sync-balances resetea el ciclo en cada aniversario.
//
// Por eso cada operación debe preguntarse dos cosas distintas:
//   1) ¿Esta solicitud SUMÓ pendingDays al crearse y ese
//      pending sigue vivo? (no lo borró un aniversario)
//   2) ¿Su startDate pertenece al ciclo vigente HOY?
// ============================================================

function startOfDayUTC(date: Date): Date {
    const d = new Date(date)
    d.setUTCHours(0, 0, 0, 0)
    return d
}

// Aniversario más reciente que ya ocurrió (inicio del ciclo actual)
// y el próximo (fin del ciclo actual / inicio del futuro)
export function getCycleBounds(entryDate: Date): { cycleStart: Date; cycleEnd: Date } {
    const today = startOfDayUTC(new Date())
    const entry = new Date(entryDate)

    const anniversaryThisYear = new Date(Date.UTC(
        today.getUTCFullYear(),
        entry.getUTCMonth(),
        entry.getUTCDate()
    ))

    if (anniversaryThisYear <= today) {
        // El aniversario de este año ya pasó (o es hoy): ciclo actual empezó este año
        return {
            cycleStart: anniversaryThisYear,
            cycleEnd: new Date(Date.UTC(today.getUTCFullYear() + 1, entry.getUTCMonth(), entry.getUTCDate()))
        }
    }
    // Aún no llega el aniversario: el ciclo actual empezó el año pasado
    return {
        cycleStart: new Date(Date.UTC(today.getUTCFullYear() - 1, entry.getUTCMonth(), entry.getUTCDate())),
        cycleEnd: anniversaryThisYear
    }
}

export type BalanceImpact = {
    // Al APROBAR (firma del jefe):
    subPendingOnApprove: boolean   // restar pendingDays (solo si su pending sigue vivo)
    addUsedOnApprove: boolean      // sumar usedDays (solo si cae en el ciclo actual)
    // Al RECHAZAR o CANCELAR antes de la firma del jefe (PENDING_BOSS):
    refundPendingBeforeBoss: boolean
    // Al CANCELAR después de la firma del jefe (PENDING_HR o APPROVED):
    refundUsedAfterBoss: boolean
}

/**
 * Clasifica una solicitud de VACACIONES según su relación con el ciclo actual.
 *
 * Casos que cubre:
 *  A) Normal: creada y con inicio en el ciclo actual
 *     → pending vivo: aprobar mueve pending→used; cancelar devuelve lo que corresponda.
 *  B) Ex-futura: creada en el ciclo ANTERIOR como "futura" (nunca sumó pending),
 *     pero hoy su startDate ya cae en el ciclo actual (el aniversario ocurrió en medio)
 *     → aprobar solo suma used; nunca hay pending que devolver.
 *  C) Futura: startDate en el próximo ciclo
 *     → no tocar NADA; sync la regulariza al renovar.
 *  D) Obsoleta: startDate quedó en un ciclo ya cerrado
 *     → no tocar NADA (el sync ya hizo borrón y cuenta nueva de ese ciclo).
 */
export function classifyBalanceImpact(
    startDate: Date,
    createdAt: Date,
    entryDate: Date
): BalanceImpact {
    const { cycleStart, cycleEnd } = getCycleBounds(entryDate)
    const start = startOfDayUTC(new Date(startDate))
    const created = new Date(createdAt)

    const inCurrentCycle = start >= cycleStart && start < cycleEnd
    const createdInCurrentCycle = created >= cycleStart
    const isFuture = start >= cycleEnd

    if (isFuture) {
        // Caso C: nada de nada
        return { subPendingOnApprove: false, addUsedOnApprove: false, refundPendingBeforeBoss: false, refundUsedAfterBoss: false }
    }

    if (!inCurrentCycle) {
        // Caso D: startDate en ciclo ya cerrado — el sync ya reseteó ese ciclo
        return { subPendingOnApprove: false, addUsedOnApprove: false, refundPendingBeforeBoss: false, refundUsedAfterBoss: false }
    }

    // startDate en el ciclo actual:
    const pendingIsAlive = createdInCurrentCycle // si se creó antes del cycleStart, era "futura" y nunca sumó pending

    return {
        subPendingOnApprove: pendingIsAlive,   // Caso A sí, Caso B no
        addUsedOnApprove: true,                // A y B suman used
        refundPendingBeforeBoss: pendingIsAlive,
        refundUsedAfterBoss: true,             // si el jefe ya firmó, used se sumó en este ciclo
    }
}