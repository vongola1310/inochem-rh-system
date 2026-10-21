'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { isWeekend, addDays, startOfDay, isBefore } from 'date-fns'
import { transitionRequest } from '@/lib/request-transition'

const prisma = new PrismaClient()

// Helper para sumar días hábiles a una fecha
function addBusinessDays(startDate: Date, days: number, holidaySet: Set<string>): Date {
  let count = 0;
  let current = new Date(startDate);
  
  while (count < days) {
    current = addDays(current, 1);
    const dateStr = current.toISOString().split('T')[0];
    const isWknd = isWeekend(current);
    const isHoliday = holidaySet.has(dateStr);

    if (!isWknd && !isHoliday) {
      count++;
    }
  }
  return current;
}

export async function runAutoApprovalCheck() {
  console.log("--- EJECUTANDO AUTO-APROBACIÓN DE GERENTES (3 DÍAS HÁBILES) ---")
  
  try {
    // 1. Obtener festivos para el cálculo
    const holidays = await prisma.holiday.findMany();
    const holidaySet = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // 2. Buscar solicitudes pendientes de Jefe
    const pendingRequests = await prisma.request.findMany({
      where: {
        status: 'PENDING_BOSS',
        // Filtramos usuarios cuyo puesto incluya "Gerente"
        user: {
            jobTitle: {
                contains: 'Gerente',
                mode: 'insensitive' // Ignora mayúsculas/minúsculas
            }
        }
      },
      include: { user: true }
    })

    const today = new Date();
    let approvedCount = 0;

    for (const req of pendingRequests) {
        // Calcular la fecha límite (Fecha Creación + 3 días hábiles)
        const deadline = addBusinessDays(req.createdAt, 3, holidaySet);
        
        // Si HOY ya pasamos la fecha límite
        if (isBefore(deadline, today)) {
            console.log(`[AUTO-APPROVE] Solicitud #${req.id.slice(-4)} de ${req.user.name} (Gerente). Creada: ${req.createdAt.toISOString().split('T')[0]}. Deadline: ${deadline.toISOString().split('T')[0]}`)
            
            // APROBAR AUTOMÁTICAMENTE (Pasar a RH)
            const changed = await transitionRequest(req.id, ['PENDING_BOSS'], 'PENDING_HR', {
                approvedByBoss: true,
                bossApprovalDate: new Date(),
            }, " \n[SISTEMA]: Aprobación automática por transcurso de 3 días hábiles sin respuesta de Dirección.")

            // Notificar a RH (opcional, crear notificación)
            /* await prisma.notification.create({ ... }) */
            
            if (changed) approvedCount++;
        }
    }

    revalidatePath('/admin')
    revalidatePath('/')
    revalidatePath('/team/history')
    return { success: true, message: `Proceso finalizado. ${approvedCount} solicitudes de Gerentes aprobadas automáticamente.` }

  } catch (error) {
    console.error("Error en auto-aprobación:", error)
    return { success: false, message: "Error al ejecutar la auto-aprobación." }
  }
}
