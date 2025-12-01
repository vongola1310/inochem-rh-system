'use server'

import { PrismaClient, RequestType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { differenceInBusinessDays, isWeekend } from 'date-fns'
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
    // 1. Extraer datos del formulario
    const rawData = {
      userId: formData.get('userId') as string,
      type: formData.get('type') as RequestType,
      startDate: new Date(formData.get('startDate') as string),
      returnDate: formData.get('returnDate') 
        ? new Date(formData.get('returnDate') as string) 
        : new Date(formData.get('startDate') as string),
      permitTime: formData.get('permitTime') as string || null,
      observations: formData.get('observations') as string,
      // Si el cliente envía daysRequested (calculado por JS), lo usamos como referencia, 
      // pero idealmente lo recalculamos aquí por seguridad.
      daysRequested: Number(formData.get('daysRequested')) || 0
    }

    // 2. Buscar usuario y su jefe (con info de respaldo)
    const user = await prisma.user.findUnique({
      where: { id: rawData.userId },
      include: { 
        balance: true,
        boss: {
            include: {
                backupUser: true // Traemos al jefe interino si existe
            }
        }
      }
    })

    if (!user || !user.bossId || !user.boss) {
      return { success: false, message: "No tienes un jefe asignado para aprobar esto." }
    }

    // 3. Lógica de Días Hábiles y Festivos (Validación de Servidor)
    let finalDaysRequested = 0;

    if (rawData.type === 'VACATION') {
        if (rawData.returnDate <= rawData.startDate) {
            return { success: false, message: "La fecha de regreso debe ser posterior." }
        }

        // Calcular días brutos (sin fines de semana)
        const businessDays = differenceInBusinessDays(rawData.returnDate, rawData.startDate)
        
        // Buscar festivos en DB que caigan en el rango
        const holidays = await prisma.holiday.findMany({
            where: {
                date: {
                    gte: rawData.startDate,
                    lt: rawData.returnDate
                }
            }
        })

        // Restar festivos que caen entre semana
        const holidaysOnWeekdays = holidays.filter(h => !isWeekend(h.date)).length
        finalDaysRequested = businessDays - holidaysOnWeekdays;

        if (finalDaysRequested < 0) finalDaysRequested = 0;

        // Validar saldo
        const currentBalance = (user.balance?.totalDays || 0) - (user.balance?.usedDays || 0) - (user.balance?.pendingDays || 0)
        
        if (finalDaysRequested > currentBalance) {
           return { success: false, message: `Saldo insuficiente. Tienes ${currentBalance} días disponibles.` }
        }
    } else {
        // Permisos
        if (rawData.type === 'PERMIT_ABSENCE') finalDaysRequested = 1;
    }

    // 4. LÓGICA DE JEFE INTERINO (Delegación)
    let notifyUserId = user.bossId; 
    let bossName = user.boss.name;

    const today = new Date();
    // Verificamos si el jefe tiene configurado un respaldo activo para HOY
    if (
        user.boss.backupId && 
        user.boss.backupStartDate && 
        user.boss.backupEndDate &&
        today >= user.boss.backupStartDate &&
        today <= user.boss.backupEndDate
    ) {
        notifyUserId = user.boss.backupId;
        console.log(`🔀 Redirigiendo solicitud de ${user.name}. El jefe ${user.boss.name} está ausente. Respaldo: ${notifyUserId}`);
    }

    // 5. Guardar en Base de Datos (Transacción)
    await prisma.$transaction(async (tx) => {
      // A) Crear Solicitud
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

      // B) Congelar saldo si son vacaciones
      if (rawData.type === 'VACATION' && finalDaysRequested > 0) {
        await tx.vacationBalance.update({
          where: { userId: user.id },
          data: { pendingDays: { increment: finalDaysRequested } }
        })
      }

      // C) Notificar al Jefe (o al Interino)
      const typeLabel = rawData.type === 'VACATION' ? 'Vacaciones' : 'Permiso Laboral';
      await tx.notification.create({
        data: {
          userId: notifyUserId, // Aquí usamos la ID calculada (Jefe o Respaldo)
          title: `Nueva Solicitud: ${typeLabel}`,
          // CORRECCIÓN: Usamos ?. para asegurar que no falle si TS cree que boss es null
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