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
// Helper: Calcula el próximo aniversario del empleado
// ============================================================
function getNextAnniversary(entryDate: Date): Date {
    const today = startOfDay(new Date());
    const entry = new Date(entryDate);
    
    const anniversaryThisYear = startOfDay(setYear(entry, today.getFullYear()));
    
    if (isBefore(anniversaryThisYear, today)) {
        return startOfDay(setYear(entry, today.getFullYear() + 1));
    }
    
    return anniversaryThisYear;
}

// ============================================================
// Helper: ¿Estamos a ≤ 3 días hábiles del aniversario?
// ============================================================
function isNearAnniversary(
    entryDate: Date,
    holidaySet: Set<string>,
    birthDate: Date | null | undefined
): { isNear: boolean; businessDaysLeft: number; anniversaryDate: Date } {
    const today = startOfDay(new Date());
    const nextAnniversary = getNextAnniversary(entryDate);
    const businessDaysLeft = countBusinessDays(today, nextAnniversary, holidaySet, birthDate);
    
    return {
        isNear: businessDaysLeft <= 3,
        businessDaysLeft,
        anniversaryDate: nextAnniversary
    };
}

// ============================================================
// Helper: Compara fechas como strings YYYY-MM-DD
// Esto evita problemas de timezone al comparar objetos Date
// ============================================================
function toDateStr(d: Date): string {
    return d.toISOString().split('T')[0];
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

    // Obtenemos festivos una sola vez
    const holidays = await prisma.holiday.findMany();
    const holidaySet = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // --- DETECCIÓN DE CRUCE DE ANIVERSARIO ---
    let splitDate: Date | null = null;

    if (type === 'VACATION') {
        const today = new Date();
        const entryDate = new Date(user.entryDate);
        const anniversaryThisYear = setYear(entryDate, today.getFullYear());
        anniversaryThisYear.setHours(0,0,0,0);

        if (isBefore(startDate, anniversaryThisYear) && isBefore(anniversaryThisYear, returnDate)) {
            splitDate = anniversaryThisYear;
        }
    }

    // ============================================================
    // Verificar proximidad al aniversario (se usa en CASO A y B)
    // ============================================================
    const anniversaryCheck = (type === 'VACATION') 
        ? isNearAnniversary(user.entryDate, holidaySet, user.birthDate)
        : null;

    // =============================================================
    // DEBUG: Revisa estos logs en la terminal de Next.js
    // Quitar cuando ya funcione correctamente
    // =============================================================
    if (type === 'VACATION' && anniversaryCheck) {
        console.log('========== DEBUG AUTO-APROBACIÓN ==========');
        console.log('Hoy (ISO):', toDateStr(startOfDay(new Date())));
        console.log('Aniversario (ISO):', toDateStr(anniversaryCheck.anniversaryDate));
        console.log('Días hábiles al aniversario:', anniversaryCheck.businessDaysLeft);
        console.log('¿Cerca? (≤3):', anniversaryCheck.isNear);
        console.log('startDate (ISO):', toDateStr(startDate));
        console.log('returnDate (ISO):', toDateStr(returnDate));
        console.log('splitDate (ISO):', splitDate ? toDateStr(splitDate) : 'null (no hay cruce)');
        console.log('Balance - total:', user.balance?.totalDays, 'used:', user.balance?.usedDays, 'pending:', user.balance?.pendingDays);
        console.log('============================================');
    }

    // --- LOGICA DE PROCESAMIENTO ---
    
    // ================================================================
    // CASO A: SOLICITUD NORMAL (Sin cruce de aniversario)
    // ================================================================
    if (!splitDate) {
        let daysRequested = 0;
        if (type === 'VACATION') {
            daysRequested = countBusinessDays(startDate, returnDate, holidaySet, user.birthDate);
            
            const currentBalance = (user.balance?.totalDays || 0) - (user.balance?.usedDays || 0) - (user.balance?.pendingDays || 0);
            if (daysRequested > currentBalance) {
                return { success: false, message: `Saldo insuficiente. Tienes ${currentBalance} días y pides ${daysRequested}.` }
            }

            // ============================================================
            // AUTO-APROBACIÓN POR VENCIMIENTO (CASO A)
            // Condiciones:
            //   1. ≤ 3 días hábiles al aniversario (anniversaryCheck.isNear)
            //   2. Tiene saldo suficiente (ya validado arriba)
            //   3. returnDate NO pasa del aniversario (comparación por string YYYY-MM-DD)
            // ============================================================
            if (anniversaryCheck?.isNear && daysRequested > 0) {
                const returnStr = toDateStr(returnDate);
                const anniversaryStr = toDateStr(anniversaryCheck.anniversaryDate);
                
                // returnDate es el día de regreso al trabajo (exclusivo)
                // Si returnDate <= aniversario, las vacaciones caen en el periodo viejo
                const vacationEndsBeforeAnniversary = returnStr <= anniversaryStr;

                console.log('DEBUG CASO A - return:', returnStr, 'aniversario:', anniversaryStr, 'autoApprove:', vacationEndsBeforeAnniversary);

                if (vacationEndsBeforeAnniversary) {
                    await createAutoApprovedRequest(
                        user, startDate, returnDate, daysRequested, observations
                    );
                    
                    revalidatePath('/');
                    return { 
                        success: true, 
                        message: `Solicitud auto-aprobada (${daysRequested} día${daysRequested > 1 ? 's' : ''}). Tu periodo vence pronto y el saldo fue descontado automáticamente.` 
                    };
                }
            }
            // Si no aplica, continúa flujo normal ↓

        } else {
             if (type === 'PERMIT_ABSENCE') daysRequested = 1;
        }

        // Flujo normal: PENDING_BOSS
        await createSingleRequest(user, type, startDate, returnDate, daysRequested, observations, permitTime, true);
        
        revalidatePath('/')
        return { success: true, message: "Solicitud enviada correctamente." }
    }

    // ================================================================
    // CASO B: SOLICITUD DIVIDIDA (Vacaciones cruzan el aniversario)
    //   Parte 1 (periodo viejo): Auto-aprobar SI estamos cerca del aniversario
    //   Parte 2 (periodo nuevo): Flujo normal con jefe + RH
    // ================================================================
    else {
        const daysPart1 = countBusinessDays(startDate, splitDate, holidaySet, user.birthDate);
        const daysPart2 = countBusinessDays(splitDate, returnDate, holidaySet, user.birthDate);

        const currentBalance = (user.balance?.totalDays || 0) - (user.balance?.usedDays || 0) - (user.balance?.pendingDays || 0);
        if (daysPart1 > currentBalance) {
            return { success: false, message: `Saldo insuficiente para el periodo actual. Tienes ${currentBalance} días antes de tu aniversario y necesitas ${daysPart1}.` }
        }

        console.log('DEBUG CASO B - part1:', daysPart1, 'part2:', daysPart2, 'nearAnniversary:', anniversaryCheck?.isNear);

        // ============================================================
        // ¿Parte 1 se auto-aprueba?
        // La Parte 1 SIEMPRE cae antes del aniversario (por definición del split)
        // Solo verificamos: estamos cerca + tiene saldo
        // ============================================================
        const autoApprovePart1 = anniversaryCheck?.isNear && daysPart1 > 0 && daysPart1 <= currentBalance;

        if (autoApprovePart1) {
            console.log('DEBUG CASO B - Auto-aprobando Parte 1, Parte 2 va con jefe');

            // Parte 1: Auto-aprobar (periodo viejo, silencioso)
            await createAutoApprovedRequest(
                user, startDate, splitDate!, daysPart1,
                `${observations} (Parte 1: Cierre de ciclo)`
            );

            // Parte 2: Flujo normal con jefe (periodo nuevo)
            await createSingleRequest(
                user, type, splitDate!, returnDate, daysPart2,
                `${observations} (Parte 2: Nuevo ciclo)`, permitTime, false
            );

            revalidatePath('/');
            return { 
                success: true, 
                message: `Se generaron 2 solicitudes. Parte 1 (${daysPart1} día${daysPart1 > 1 ? 's' : ''}) auto-aprobada por vencimiento. Parte 2 (${daysPart2} día${daysPart2 > 1 ? 's' : ''}) enviada a tu jefe.` 
            };
        }

        // Si NO estamos cerca del aniversario, flujo original (ambas pasan por jefe)
        await prisma.$transaction(async (tx) => {
            await createSingleRequestTx(tx, user, type, startDate, splitDate!, daysPart1, `${observations} (Parte 1: Cierre de ciclo)`, permitTime, true);
            await createSingleRequestTx(tx, user, type, splitDate!, returnDate, daysPart2, `${observations} (Parte 2: Nuevo ciclo)`, permitTime, false);
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
// Crear solicitud auto-aprobada por vencimiento
// ============================================================
async function createAutoApprovedRequest(
    user: any,
    startDate: Date,
    returnDate: Date,
    daysRequested: number,
    observations: string
) {
    await prisma.$transaction(async (tx) => {
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
                approvedByBoss: true,
                bossApprovalDate: new Date(),
                approvedByHR: true,
                hrApprovalDate: new Date(),
            }
        });

        await tx.vacationBalance.update({
            where: { userId: user.id },
            data: {
                usedDays: { increment: daysRequested }
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