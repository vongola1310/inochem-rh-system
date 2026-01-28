'use server'

import { PrismaClient, RequestType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { differenceInBusinessDays, isWeekend, isSameDay, setYear } from 'date-fns'
import { z } from 'zod'

const prisma = new PrismaClient()

const requestSchema = z.object({
  userId: z.string(),
  type: z.string(),
  startDate: z.date(),
  returnDate: z.date().optional(),
  permitTime: z.string().optional(),
  observations: z.string().optional(),
})

export async function createRequest(prevState: any, formData: FormData) {
  try {
    const rawData = {
      userId: formData.get('userId') as string,
      type: formData.get('type') as RequestType,
      startDate: new Date(formData.get('startDate') as string),
      returnDate: formData.get('returnDate') 
        ? new Date(formData.get('returnDate') as string) 
        : new Date(formData.get('startDate') as string),
      permitTime: formData.get('permitTime') as string || null,
      observations: formData.get('observations') as string,
      daysRequested: Number(formData.get('daysRequested')) || 0
    }

    const user = await prisma.user.findUnique({
      where: { id: rawData.userId },
      include: { 
        balance: true,
        boss: {
            include: {
                backupUser: true 
            }
        }
      }
    })

    if (!user || !user.bossId || !user.boss) {
      return { success: false, message: "No tienes un jefe asignado para aprobar esto." }
    }

    // --- LÓGICA DE DÍAS HÁBILES + FESTIVOS + CUMPLEAÑOS ---
    let finalDaysRequested = 0;

    if (rawData.type === 'VACATION') {
        if (rawData.returnDate <= rawData.startDate) {
            return { success: false, message: "La fecha de regreso debe ser posterior." }
        }

        // 1. Obtener festivos en el rango
        const holidays = await prisma.holiday.findMany({
            where: {
                date: {
                    gte: rawData.startDate,
                    lt: rawData.returnDate
                }
            }
        })
        
        const holidaySet = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

        // 2. Cálculo día por día (ROBUSTO)
        let count = 0;
        // Ajustamos horas para evitar problemas de iteración
        let currentDate = new Date(rawData.startDate);
        currentDate.setUTCHours(12, 0, 0, 0); // Mediodía UTC para seguridad
        
        const endDate = new Date(rawData.returnDate);
        endDate.setUTCHours(12, 0, 0, 0);

        while (currentDate < endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const isWknd = isWeekend(currentDate);
            const isHoliday = holidaySet.has(dateStr);
            
            // 3. CHEQUEO DE CUMPLEAÑOS (Ignorando año y hora)
            let isBirthday = false;
            if (user.birthDate) {
                const bdate = new Date(user.birthDate);
                // Comparación estricta de Mes y Día en UTC
                const birthMonthDay = `${String(bdate.getUTCMonth() + 1).padStart(2, '0')}-${String(bdate.getUTCDate()).padStart(2, '0')}`;
                const currentMonthDay = `${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDate.getUTCDate()).padStart(2, '0')}`;
                
                if (birthMonthDay === currentMonthDay) {
                    isBirthday = true;
                }
            }

            // Solo cobramos si es día hábil normal (No finde, No festivo, No cumple)
            if (!isWknd && !isHoliday && !isBirthday) {
                count++;
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        finalDaysRequested = count;

        const currentBalance = (user.balance?.totalDays || 0) - (user.balance?.usedDays || 0) - (user.balance?.pendingDays || 0)
        
        if (finalDaysRequested > currentBalance) {
           return { success: false, message: `Saldo insuficiente. Tienes ${currentBalance} días disponibles.` }
        }
    } else {
        if (rawData.type === 'PERMIT_ABSENCE') finalDaysRequested = 1;
    }

    // --- LÓGICA DE JEFE INTERINO ---
    let notifyUserId = user.bossId; 
    
    const now = new Date();
    if (user.boss.backupId && user.boss.backupStartDate && user.boss.backupEndDate) {
        const startRange = new Date(user.boss.backupStartDate); startRange.setHours(0,0,0,0);
        const endRange = new Date(user.boss.backupEndDate); endRange.setHours(23,59,59,999);
        
        if (now >= startRange && now <= endRange) {
            notifyUserId = user.boss.backupId;
        }
    }

    await prisma.$transaction(async (tx) => {
      const newRequest = await tx.request.create({
        data: {
          userId: user.id,
          type: rawData.type,
          status: 'PENDING_BOSS',
          startDate: rawData.startDate,
          returnDate: rawData.returnDate,
          daysRequested: finalDaysRequested,
          observations: rawData.observations,
          permitTime: rawData.permitTime,
        }
      })

      if (rawData.type === 'VACATION' && finalDaysRequested > 0) {
        await tx.vacationBalance.update({
          where: { userId: user.id },
          data: { pendingDays: { increment: finalDaysRequested } }
        })
      }

      const typeLabel = rawData.type === 'VACATION' ? 'Vacaciones' : 'Permiso Laboral';
      await tx.notification.create({
        data: {
          userId: notifyUserId,
          title: `Nueva Solicitud: ${typeLabel}`,
          message: `${user.name} solicita aprobación. ${user.boss?.backupId === notifyUserId ? '(Eres el respaldo asignado)' : ''}`,
          link: `/dashboard/requests/${newRequest.id}`
        }
      })
    })

    revalidatePath('/')
    return { success: true, message: "Solicitud enviada correctamente." }

  } catch (error) {
    console.error(error)
    return { success: false, message: "Error al procesar la solicitud." }
  }
}