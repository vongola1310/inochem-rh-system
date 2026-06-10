'use server'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type AuditResult = {
    name: string
    userId: string
    currentUsed: number
    currentPending: number
    correctUsed: number
    correctPending: number
    usedDiff: number
    pendingDiff: number
    hasIssue: boolean
}

/**
 * Audita TODOS los empleados comparando su saldo actual
 * contra lo que dice su historial de solicitudes.
 * 
 * Lógica:
 * - usedDays correcto = suma de daysRequested de solicitudes APPROVED tipo VACATION
 * - pendingDays correcto = suma de daysRequested de solicitudes PENDING_BOSS o PENDING_HR tipo VACATION
 * - Si hay diferencia → inconsistencia (bug de sync o cancel)
 */
export async function auditBalances(): Promise<{ results: AuditResult[], fixed: number }> {
    const users = await prisma.user.findMany({
        where: {
            name: { not: 'Administrador' }
        },
        include: {
            balance: true,
            requests: {
                where: {
                    type: 'VACATION'
                },
                select: {
                    status: true,
                    daysRequested: true,
                    startDate: true,
                }
            }
        }
    })

    const results: AuditResult[] = []

    for (const user of users) {
        if (!user.balance) continue

        // Calcular lo correcto basado en solicitudes reales
        const correctUsed = user.requests
            .filter(r => r.status === 'APPROVED')
            .reduce((sum, r) => sum + r.daysRequested, 0)

        const correctPending = user.requests
            .filter(r => r.status === 'PENDING_BOSS' || r.status === 'PENDING_HR')
            .reduce((sum, r) => sum + r.daysRequested, 0)

        const currentUsed = user.balance.usedDays
        const currentPending = user.balance.pendingDays

        const usedDiff = currentUsed - correctUsed
        const pendingDiff = currentPending - correctPending
        const hasIssue = usedDiff !== 0 || pendingDiff !== 0

        results.push({
            name: user.name,
            userId: user.id,
            currentUsed,
            currentPending,
            correctUsed,
            correctPending,
            usedDiff,
            pendingDiff,
            hasIssue,
        })
    }

    // Ordenar: primero los que tienen problemas
    results.sort((a, b) => {
        if (a.hasIssue && !b.hasIssue) return -1
        if (!a.hasIssue && b.hasIssue) return 1
        return a.name.localeCompare(b.name)
    })

    return { results, fixed: 0 }
}

/**
 * Corrige TODOS los saldos inconsistentes de una sola vez.
 * Recalcula usedDays y pendingDays desde el historial real de solicitudes.
 */
export async function fixAllBalances(): Promise<{ fixed: number, details: string[] }> {
    const users = await prisma.user.findMany({
        where: {
            name: { not: 'Administrador' }
        },
        include: {
            balance: true,
            requests: {
                where: {
                    type: 'VACATION'
                },
                select: {
                    status: true,
                    daysRequested: true,
                }
            }
        }
    })

    const details: string[] = []
    let fixed = 0

    for (const user of users) {
        if (!user.balance) continue

        const correctUsed = user.requests
            .filter(r => r.status === 'APPROVED')
            .reduce((sum, r) => sum + r.daysRequested, 0)

        const correctPending = user.requests
            .filter(r => r.status === 'PENDING_BOSS' || r.status === 'PENDING_HR')
            .reduce((sum, r) => sum + r.daysRequested, 0)

        const needsFix = user.balance.usedDays !== correctUsed || user.balance.pendingDays !== correctPending

        if (needsFix) {
            await prisma.vacationBalance.update({
                where: { userId: user.id },
                data: {
                    usedDays: correctUsed,
                    pendingDays: correctPending,
                }
            })

            details.push(
                `${user.name}: usedDays ${user.balance.usedDays} → ${correctUsed}, pendingDays ${user.balance.pendingDays} → ${correctPending}`
            )
            fixed++
        }
    }

    return { fixed, details }
}