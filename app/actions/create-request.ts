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

    // --- CÁLCULOS DE FECHAS CLAVE ---
    const today = startOfDay(new Date());
    const entryDate = new Date(user.entryDate);
    const anniversaryThisYear = setYear(entryDate, today.getFullYear());
    anniversaryThisYear.setHours(0,0,0,0);

    // DETECCIÓN DE "ZONA DE PELIGRO" (Faltan 15 días o menos para el aniversario)
    const daysToAnniversary = differenceInCalendarDays(anniversaryThisYear, today);
    const isDangerZone = type === 'VACATION' && daysToAnniversary >= 0 && daysToAnniversary <= 15;

    // DETECCIÓN DE CRUCE DE ANIVERSARIO
    let splitDate: Date | null = null;
    if (type === 'VACATION') {
        if (isBefore(startDate, anniversaryThisYear) && isBefore(anniversaryThisYear, returnDate)) {
            splitDate = anniversaryThisYear;
        }
    }

    const holidays = await prisma.holiday.findMany();
    const holidaySet = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // --- LÓGICA DE PROCESAMIENTO ---
    
    // CASO A: SOLICITUD NORMAL (Sin cruce)
    if (!splitDate) {
        let daysRequested = 0;
        if (type === 'VACATION') {
            daysRequested = countBusinessDays(startDate, returnDate, holidaySet, user.birthDate);
            
            const currentBalance = (user.balance?.totalDays || 0) - (user.balance?.usedDays || 0) - (user.balance?.pendingDays || 0);
            if (daysRequested > currentBalance) {
                return { success: false, message: `Saldo insuficiente. Tienes ${currentBalance} días y pides ${daysRequested}.` }
            }
        } else {
             if (type === 'PERMIT_ABSENCE') daysRequested = 1;
        }

        // Si estamos en la zona de peligro, Auto-Aprobamos. Si no, flujo normal.
        await createSingleRequest(user, type, startDate, returnDate, daysRequested, observations, permitTime, true, isDangerZone);
        
        revalidatePath('/')
        return { 
            success: true, 
            message: isDangerZone 
                ? "¡Aprobada automáticamente! Faltan menos de 15 días para tu aniversario." 
                : "Solicitud enviada correctamente." 
        }
    }

    // CASO B: SOLICITUD DIVIDIDA (Vacaciones Puente)
    else {
        const daysPart1 = countBusinessDays(startDate, splitDate, holidaySet, user.birthDate);
        const daysPart2 = countBusinessDays(splitDate, returnDate, holidaySet, user.birthDate);

        const currentBalance = (user.balance?.totalDays || 0) - (user.balance?.usedDays || 0) - (user.balance?.pendingDays || 0);
        if (daysPart1 > currentBalance) {
            return { success: false, message: `Saldo insuficiente para el periodo actual. Tienes ${currentBalance} días antes del aniversario.` }
        }

        await prisma.$transaction(async (tx) => {
            // Parte 1 (Viejo saldo): Como cruza el aniversario, ESTÁ EN ZONA DE PELIGRO por definición. Se Auto-Aprueba.
            await createSingleRequestTx(tx, user, type, startDate, splitDate, daysPart1, `${observations} (Parte 1: Cierre de ciclo)`, permitTime, true, true);

            // Parte 2 (Nuevo saldo): Pertenece al nuevo año. Hay tiempo, sigue el flujo normal con el Jefe.
            await createSingleRequestTx(tx, user, type, splitDate, returnDate, daysPart2, `${observations} (Parte 2: Nuevo ciclo)`, permitTime, false, false);
        });

        revalidatePath('/')
        return { success: true, message: "Solicitud dividida: Los días viejos se auto-aprobaron, los nuevos van a firma del jefe." }
    }

  } catch (error) {
    console.error(error)
    return { success: false, message: "Error al procesar la solicitud." }
  }
}

// Helper para crear solicitud dentro de transacción
async function createSingleRequestTx(tx: any, user: any, type: RequestType, start: Date, end: Date, days: number, obs: string, time: string | null, updateBalance: boolean, autoApprove: boolean = false) {
    
    let notifyUserId = user.bossId;
    const now = new Date();
    if (user.boss.backupId && user.boss.backupStartDate && user.boss.backupEndDate) {
        const startRange = new Date(user.boss.backupStartDate); startRange.setHours(0,0,0,0);
        const endRange = new Date(user.boss.backupEndDate); endRange.setHours(23,59,59,999);
        if (now >= startRange && now <= endRange) notifyUserId = user.boss.backupId;
    }

    // Configuración según si hay Auto-Aprobación de Emergencia
    const finalStatus = autoApprove ? 'APPROVED' : 'PENDING_BOSS';
    const finalObs = autoApprove ? `${obs}\n[SISTEMA]: Auto-aprobación de emergencia por límite de vencimiento del periodo.` : obs;

    const newRequest = await tx.request.create({
        data: {
            userId: user.id,
            type: type,
            status: finalStatus,
            approvedByBoss: autoApprove,
            approvedByHR: autoApprove,
            bossApprovalDate: autoApprove ? new Date() : null,
            hrApprovalDate: autoApprove ? new Date() : null,
            startDate: start,
            returnDate: end,
            daysRequested: days,
            observations: finalObs,
            permitTime: time,
        }
    })

    // Actualización de Saldo Dinámica
    if (type === 'VACATION' && days > 0 && updateBalance) {
        if (autoApprove) {
            // Si se auto-aprueba, se cuenta como "Usado" de inmediato
            await tx.vacationBalance.update({
                where: { userId: user.id },
                data: { usedDays: { increment: days } }
            })
        } else {
            // Si no, se cuenta como "Pendiente"
            await tx.vacationBalance.update({
                where: { userId: user.id },
                data: { pendingDays: { increment: days } }
            })
        }
    }

    // Notificaciones
    const typeLabel = type === 'VACATION' ? 'Vacaciones' : 'Permiso Laboral';
    
    if (autoApprove) {
        // Le avisamos al empleado
        await tx.notification.create({
            data: {
                userId: user.id,
                title: `Aprobación Express`,
                message: `Tus vacaciones se auto-aprobaron porque tu saldo estaba por caducar.`,
                link: `/dashboard/requests/${newRequest.id}`
            }
        })
        // Le avisamos al Jefe solo para que sepa
        await tx.notification.create({
            data: {
                userId: notifyUserId,
                title: `Aviso del Sistema`,
                message: `Se auto-aprobaron días de ${user.name} por vencimiento de ciclo.`,
                link: `/dashboard/requests/${newRequest.id}`
            }
        })
    } else {
        // Flujo normal
        await tx.notification.create({
            data: {
                userId: notifyUserId,
                title: `Nueva Solicitud: ${typeLabel}`,
                message: `${user.name} solicita aprobación.`,
                link: `/dashboard/requests/${newRequest.id}`
            }
        })
    }
}

// Wrapper para llamada simple (sin Tx externa)
async function createSingleRequest(user: any, type: RequestType, start: Date, end: Date, days: number, obs: string, time: string | null, updateBalance: boolean, autoApprove: boolean = false) {
    return await prisma.$transaction(async (tx) => {
        await createSingleRequestTx(tx, user, type, start, end, days, obs, time, updateBalance, autoApprove)
    })
}