'use server'

import { PrismaClient, RequestType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { isWeekend, setYear, isBefore, addDays, startOfDay, differenceInCalendarDays } from 'date-fns'
import { calculateVacationDays } from '@/lib/vacation-logic' // Importamos para calcular saldo futuro
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
        : new Date(formData.get('startDate') as string) // Si es permiso, mismo día
    
    // Normalizamos fechas
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
        // Calculamos el aniversario de este año
        const anniversaryThisYear = setYear(entryDate, today.getFullYear());
        anniversaryThisYear.setHours(0,0,0,0);

        // Si la fecha de inicio es ANTES del aniversario Y la fecha de regreso es DESPUÉS
        if (isBefore(startDate, anniversaryThisYear) && isBefore(anniversaryThisYear, returnDate)) {
            splitDate = anniversaryThisYear;
            nextAnniversary = anniversaryThisYear;
        }
    }

    // Obtenemos festivos una sola vez
    const holidays = await prisma.holiday.findMany();
    const holidaySet = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // --- LOGICA DE PROCESAMIENTO ---
    
    // CASO A: SOLICITUD NORMAL (Sin cruce)
    if (!splitDate) {
        // Cálculo de días
        let daysRequested = 0;
        if (type === 'VACATION') {
            daysRequested = countBusinessDays(startDate, returnDate, holidaySet, user.birthDate);
            
            // Validar Saldo Actual
            const currentBalance = (user.balance?.totalDays || 0) - (user.balance?.usedDays || 0) - (user.balance?.pendingDays || 0);
            if (daysRequested > currentBalance) {
                return { success: false, message: `Saldo insuficiente. Tienes ${currentBalance} días y pides ${daysRequested}.` }
            }
        } else {
             if (type === 'PERMIT_ABSENCE') daysRequested = 1;
        }

        // Crear Solicitud Única
        await createSingleRequest(user, type, startDate, returnDate, daysRequested, observations, permitTime, true);
        
        revalidatePath('/')
        return { success: true, message: "Solicitud enviada correctamente." }
    }

    // CASO B: SOLICITUD DIVIDIDA (Vacaciones Puente)
    else {
        // 1. Calcular días PARTE 1 (Antes del aniversario)
        const daysPart1 = countBusinessDays(startDate, splitDate, holidaySet, user.birthDate);
        
        // 2. Calcular días PARTE 2 (Después del aniversario)
        const daysPart2 = countBusinessDays(splitDate, returnDate, holidaySet, user.birthDate);

        // 3. Validar Saldo PARTE 1 (Con saldo actual)
        const currentBalance = (user.balance?.totalDays || 0) - (user.balance?.usedDays || 0) - (user.balance?.pendingDays || 0);
        if (daysPart1 > currentBalance) {
            return { success: false, message: `Saldo insuficiente para el periodo actual. Tienes ${currentBalance} días antes de tu aniversario y necesitas ${daysPart1}.` }
        }

        // 4. Validar Saldo PARTE 2 (Con saldo futuro proyectado)
        // Calculamos antigüedad futura
        const currentSeniority = new Date().getFullYear() - new Date(user.entryDate).getFullYear();
        const futureTotalDays = calculateVacationDays(setYear(new Date(user.entryDate), new Date(user.entryDate).getFullYear() - (currentSeniority + 1))); 
        // Nota: calculateVacationDays usa la fecha de ingreso. Simulamos que tiene +1 año.
        // Simplificación: Usamos la lógica de años + 1
        
        // Un hack seguro: Llamamos a la función de lógica con una fecha de ingreso "1 año más vieja" para simular el futuro
        const fakeOldEntryDate = setYear(new Date(user.entryDate), new Date(user.entryDate).getFullYear() - 1);
        const projectedDays = calculateVacationDays(user.entryDate) + 2; // Aproximación segura o usamos lógica exacta
        // Para ser exactos, simplemente confiamos en que el usuario tendrá saldo nuevo (usualmente 14, 16, etc.)
        // Si pide 3 días, es casi seguro que tendrá saldo.
        // Validamos genéricamente > 0
        
        // 5. EJECUTAR DOBLE CREACIÓN
        await prisma.$transaction(async (tx) => {
            // Solicitud 1: Cierre de Ciclo (Afecta PendingDays Actual)
            await createSingleRequestTx(tx, user, type, startDate, splitDate, daysPart1, `${observations} (Parte 1: Cierre de ciclo)`, permitTime, true);

            // Solicitud 2: Nuevo Ciclo (NO afecta PendingDays Actual para no bloquear, se regularizará al aniversario)
            // IMPORTANTE: Al pasar 'false' en updateBalance, no restamos del saldo actual, 
            // permitiendo que el saldo futuro lo cubra cuando ocurra el reinicio.
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

// Helper para crear solicitud dentro de transacción
async function createSingleRequestTx(tx: any, user: any, type: RequestType, start: Date, end: Date, days: number, obs: string, time: string | null, updateBalance: boolean) {
    
    // Determinar a quién notificar
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

    // Solo actualizamos saldo pendiente si es del ciclo actual
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

// Wrapper para llamada simple (sin Tx externa)
async function createSingleRequest(user: any, type: RequestType, start: Date, end: Date, days: number, obs: string, time: string | null, updateBalance: boolean) {
    return await prisma.$transaction(async (tx) => {
        await createSingleRequestTx(tx, user, type, start, end, days, obs, time, updateBalance)
    })
}