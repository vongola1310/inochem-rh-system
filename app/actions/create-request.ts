'use server'

import { PrismaClient, RequestType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { isWeekend, setYear, isBefore, addDays, startOfDay, differenceInCalendarDays } from 'date-fns'
import { calculateVacationDays } from '@/lib/vacation-logic'
import { z } from 'zod'

const prisma = new PrismaClient()

// Helper para contar días hábiles en un rango
function countBusinessDays(start: Date, end: Date, holidaysSet: Set<string>, birthDate?: Date | null): number {
    let count = 0;
    let current = new Date(start);
    current.setHours(0,0,0,0);
    const endDay = new Date(end);
    endDay.setHours(0,0,0,0);

    while (current < endDay) {
        const dateStr = current.toISOString().split('T')[0];
        const isWknd = isWeekend(current);
        const isHoliday = holidaysSet.has(dateStr);
        
        let isBirthday = false;
        if (birthDate) {
            const bdate = new Date(birthDate);
            const birthMMDD = `${String(bdate.getUTCMonth() + 1).padStart(2, '0')}-${String(bdate.getUTCDate()).padStart(2, '0')}`;
            const currentMMDD = `${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
            if (birthMMDD === currentMMDD) isBirthday = true;
        }

        if (!isWknd && !isHoliday && !isBirthday) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

// ============================================================
// NUEVO: Helper para calcular el próximo aniversario del empleado
// ============================================================
function getNextAnniversary(entryDate: Date): Date {
    const today = startOfDay(new Date());
    const entry = new Date(entryDate);
    
    // Aniversario de este año
    const anniversaryThisYear = startOfDay(setYear(entry, today.getFullYear()));
    
    // Si ya pasó el aniversario de este año, el próximo es el del año siguiente
    if (isBefore(anniversaryThisYear, today)) {
        return startOfDay(setYear(entry, today.getFullYear() + 1));
    }
    
    return anniversaryThisYear;
}

// ============================================================
// NUEVO: Verifica si aplica auto-aprobación por vencimiento
// Reglas:
//   1. Faltan ≤ 3 días hábiles para el aniversario
//   2. Días pedidos ≤ saldo disponible del periodo actual
//   3. Las vacaciones NO cruzan al periodo nuevo (terminan antes del aniversario)
// ============================================================
function shouldAutoApproveExpiring(
    startDate: Date,
    returnDate: Date,
    entryDate: Date,
    holidaySet: Set<string>,
    birthDate: Date | null | undefined,
    currentBalance: number,
    daysRequested: number
): { autoApprove: boolean; reason?: string } {
    
    const today = startOfDay(new Date());
    const nextAnniversary = getNextAnniversary(entryDate);
    
    // 1. ¿Faltan ≤ 3 días hábiles para el aniversario?
    const businessDaysToAnniversary = countBusinessDays(today, nextAnniversary, holidaySet, birthDate);
    
    if (businessDaysToAnniversary > 3) {
        return { autoApprove: false, reason: `Faltan ${businessDaysToAnniversary} días hábiles para el aniversario (se requieren ≤ 3).` };
    }
    
    // 2. ¿Tiene saldo suficiente?
    if (daysRequested > currentBalance) {
        return { autoApprove: false, reason: `Saldo insuficiente: tiene ${currentBalance}, pide ${daysRequested}.` };
    }
    
    // 3. ¿Las vacaciones terminan ANTES del aniversario? (no cruzan al periodo nuevo)
    //    returnDate es la fecha de regreso (el último día de vacaciones + 1 en tu lógica de conteo)
    //    Verificamos que la fecha de retorno no pase del aniversario
    if (!isBefore(returnDate, nextAnniversary) && differenceInCalendarDays(returnDate, nextAnniversary) > 0) {
        return { autoApprove: false, reason: 'Las vacaciones cruzan al periodo nuevo.' };
    }
    
    return { autoApprove: true };
}


export async function createRequest(prevState: any, formData: FormData) {
  try {
    const userId = formData.get('userId') as string
    const type = formData.get('type') as RequestType
    const startDateRaw = new Date(formData.get('startDate') as string)
    const returnDateRaw = formData.get('returnDate') 
        ? new Date(formData.get('returnDate') as string) 
        : new Date(formData.get('startDate') as string)
    
    const startDate = startOfDay(startDateRaw)
    const returnDate = startOfDay(returnDateRaw)

    const permitTime = formData.get('permitTime') as string || null
    const observations = formData.get('observations') as string

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        balance: true,
        boss: { include: { backupUser: true } }
      }
    })

    if (!user || !user.bossId || !user.boss) {
      return { success: false, message: "No tienes un jefe asignado." }
    }

    // --- DETECCIÓN DE CRUCE DE ANIVERSARIO ---
    let splitDate: Date | null = null;
    let nextAnniversary: Date | null = null;

    if (type === 'VACATION') {
        const today = new Date();
        const entryDate = new Date(user.entryDate);
        const anniversaryThisYear = setYear(entryDate, today.getFullYear());
        anniversaryThisYear.setHours(0,0,0,0);

        if (isBefore(startDate, anniversaryThisYear) && isBefore(anniversaryThisYear, returnDate)) {
            splitDate = anniversaryThisYear;
            nextAnniversary = anniversaryThisYear;
        }
    }

    // Obtenemos festivos una sola vez
    const holidays = await prisma.holiday.findMany();
    const holidaySet = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // --- LOGICA DE PROCESAMIENTO ---
    
    // CASO A: SOLICITUD NORMAL (Sin cruce de aniversario)
    if (!splitDate) {
        let daysRequested = 0;
        if (type === 'VACATION') {
            daysRequested = countBusinessDays(startDate, returnDate, holidaySet, user.birthDate);
            
            const currentBalance = (user.balance?.totalDays || 0) - (user.balance?.usedDays || 0) - (user.balance?.pendingDays || 0);
            if (daysRequested > currentBalance) {
                return { success: false, message: `Saldo insuficiente. Tienes ${currentBalance} días y pides ${daysRequested}.` }
            }

            // ============================================================
            // NUEVO: Evaluar auto-aprobación por vencimiento de periodo
            // ============================================================
            const autoApprovalCheck = shouldAutoApproveExpiring(
                startDate,
                returnDate,
                user.entryDate,
                holidaySet,
                user.birthDate,
                currentBalance,
                daysRequested
            );

            if (autoApprovalCheck.autoApprove) {
                // AUTO-APROBAR: Crear solicitud directamente como APPROVED
                await createAutoApprovedRequest(
                    user,
                    startDate,
                    returnDate,
                    daysRequested,
                    observations
                );
                
                revalidatePath('/');
                return { 
                    success: true, 
                    message: `Solicitud auto-aprobada (${daysRequested} días). Tu periodo vence pronto y el saldo fue descontado automáticamente.` 
                };
            }
            // Si no aplica auto-aprobación, continúa flujo normal ↓

        } else {
             if (type === 'PERMIT_ABSENCE') daysRequested = 1;
        }

        // Flujo normal: PENDING_BOSS
        await createSingleRequest(user, type, startDate, returnDate, daysRequested, observations, permitTime, true);
        
        revalidatePath('/')
        return { success: true, message: "Solicitud enviada correctamente." }
    }

    // CASO B: SOLICITUD DIVIDIDA (Vacaciones Puente)
    else {
        const daysPart1 = countBusinessDays(startDate, splitDate, holidaySet, user.birthDate);
        const daysPart2 = countBusinessDays(splitDate, returnDate, holidaySet, user.birthDate);

        const currentBalance = (user.balance?.totalDays || 0) - (user.balance?.usedDays || 0) - (user.balance?.pendingDays || 0);
        if (daysPart1 > currentBalance) {
            return { success: false, message: `Saldo insuficiente para el periodo actual. Tienes ${currentBalance} días antes de tu aniversario y necesitas ${daysPart1}.` }
        }

        const fakeOldEntryDate = setYear(new Date(user.entryDate), new Date(user.entryDate).getFullYear() - 1);
        const projectedDays = calculateVacationDays(user.entryDate) + 2;
        
        await prisma.$transaction(async (tx) => {
            await createSingleRequestTx(tx, user, type, startDate, splitDate, daysPart1, `${observations} (Parte 1: Cierre de ciclo)`, permitTime, true);
            await createSingleRequestTx(tx, user, type, splitDate, returnDate, daysPart2, `${observations} (Parte 2: Nuevo ciclo)`, permitTime, false);
        });

        revalidatePath('/')
        return { success: true, message: "Se generaron 2 solicitudes automáticas por cruce de aniversario." }
    }

  } catch (error) {
    console.error(error)
    return { success: false, message: "Error al procesar la solicitud." }
  }
}


// ============================================================
// NUEVO: Crear solicitud auto-aprobada por vencimiento
// - Estado directo: APPROVED (salta PENDING_BOSS y PENDING_HR)
// - Descuenta de usedDays inmediatamente
// - Registra approvedBy como "SYSTEM_AUTO_EXPIRING"
// - Sin notificación a jefe ni RH (flujo silencioso)
// ============================================================
async function createAutoApprovedRequest(
    user: any,
    startDate: Date,
    returnDate: Date,
    daysRequested: number,
    observations: string
) {
    await prisma.$transaction(async (tx) => {
        // 1. Crear la solicitud ya aprobada
        await tx.request.create({
            data: {
                userId: user.id,
                type: 'VACATION',
                status: 'APPROVED',
                startDate: startDate,
                returnDate: returnDate,
                daysRequested: daysRequested,
                observations: `${observations} [Auto-aprobado por vencimiento de periodo - SYSTEM_AUTO_EXPIRING]`,
                permitTime: null,
                approvedByBoss: true,           // Salta aprobación de jefe
                bossApprovalDate: new Date(),
                approvedByHR: true,             // Salta aprobación de RH
                hrApprovalDate: new Date(),
            }
        });

        // 2. Descontar directamente de usedDays (como hace hr-approve.ts)
        await tx.vacationBalance.update({
            where: { userId: user.id },
            data: {
                usedDays: { increment: daysRequested }
                // NO tocamos pendingDays porque nunca pasó por pending
            }
        });
    });
}


// Helper para crear solicitud dentro de transacción (SIN CAMBIOS)
async function createSingleRequestTx(tx: any, user: any, type: RequestType, start: Date, end: Date, days: number, obs: string, time: string | null, updateBalance: boolean) {
    
    let notifyUserId = user.bossId;
    const now = new Date();
    if (user.boss.backupId && user.boss.backupStartDate && user.boss.backupEndDate) {
        const startRange = new Date(user.boss.backupStartDate); startRange.setHours(0,0,0,0);
        const endRange = new Date(user.boss.backupEndDate); endRange.setHours(23,59,59,999);
        if (now >= startRange && now <= endRange) notifyUserId = user.boss.backupId;
    }

    const newRequest = await tx.request.create({
        data: {
            userId: user.id,
            type: type,
            status: 'PENDING_BOSS',
            startDate: start,
            returnDate: end,
            daysRequested: days,
            observations: obs,
            permitTime: time,
        }
    })

    if (type === 'VACATION' && days > 0 && updateBalance) {
        await tx.vacationBalance.update({
            where: { userId: user.id },
            data: { pendingDays: { increment: days } }
        })
    }

    const typeLabel = type === 'VACATION' ? 'Vacaciones' : 'Permiso Laboral';
    await tx.notification.create({
        data: {
            userId: notifyUserId,
            title: `Nueva Solicitud: ${typeLabel}`,
            message: `${user.name} solicita aprobación.`,
            link: `/dashboard/requests/${newRequest.id}`
        }
    })
}

// Wrapper para llamada simple (SIN CAMBIOS)
async function createSingleRequest(user: any, type: RequestType, start: Date, end: Date, days: number, obs: string, time: string | null, updateBalance: boolean) {
    return await prisma.$transaction(async (tx) => {
        await createSingleRequestTx(tx, user, type, start, end, days, obs, time, updateBalance)
    })
}