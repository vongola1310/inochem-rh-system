'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { calculateVacationDays } from '@/lib/vacation-logic'

const prisma = new PrismaClient()

export async function syncAllBalances(formData?: FormData) {
  console.log("--- INICIANDO SINCRONIZACIÓN (V4: Golden Rule) ---")
  
  try {
    const users = await prisma.user.findMany({
      include: { balance: true }
    })

    const today = new Date()
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-11
    const currentDay = today.getDate();

    let updatedCount = 0

    for (const user of users) {
      if (!user.balance) continue 

      const entryDateRaw = new Date(user.entryDate);
      const entryYear = entryDateRaw.getFullYear();
      const entryMonth = entryDateRaw.getMonth();
      const entryDay = entryDateRaw.getDate();

      // 1. CÁLCULO MANUAL DE ANTIGÜEDAD
      let yearsCompleted = currentYear - entryYear;
      if (currentMonth < entryMonth) {
          yearsCompleted--;
      } else if (currentMonth === entryMonth && currentDay < entryDay) {
          yearsCompleted--;
      }

      const lastProcessed = user.balance.lastYearProcessed || 0
      const targetTotal = getDaysByYears(yearsCompleted); 
      const currentTotal = user.balance.totalDays
      const currentUsed = user.balance.usedDays

      // --- CRITERIO DE FECHA ---
      // ¿Ya pasó (o es hoy) el aniversario de este año?
      let isAnniversaryPassed = false;
      if (currentMonth > entryMonth) isAnniversaryPassed = true;
      else if (currentMonth === entryMonth && currentDay >= entryDay) isAnniversaryPassed = true;

      // --- DIAGNÓSTICO ---
      const isTargetUser = user.name.toUpperCase().includes("ESMERALDA") || user.name.toUpperCase().includes("KAREN");
      
      let shouldUpdate = false;
      let reason = "";

      if (yearsCompleted > 0) {
          // CASO 1: Fecha Cumplida (Esmeralda)
          if (isAnniversaryPassed) {
              // Si la fecha ya pasó, el estado DEBE ser perfecto para el nuevo ciclo.
              // Debe tener el año actualizado, el total correcto y 0 usados (borrón y cuenta nueva).
              // Si CUALQUIERA de estos falla, forzamos el reinicio.
              if (lastProcessed !== yearsCompleted || currentTotal !== targetTotal || currentUsed !== 0) {
                  shouldUpdate = true;
                  reason = "Aniversario Cumplido -> Normalizar Ciclo";
              }
          }
          // CASO 2: Fecha Futura (Karen)
          else {
              // Aún no cumple años. 
              // Solo actualizamos si tiene un retraso de años anteriores.
              // Si lastProcessed == yearsCompleted, asumimos que su ciclo actual (anterior al cumple) es válido y NO LA TOCAMOS.
              if (lastProcessed < yearsCompleted) {
                   shouldUpdate = true;
                   reason = "Actualización pendiente de ciclo anterior";
              }
          }
      }

      if (isTargetUser) {
          console.log(`[DEBUG] ${user.name}`)
          console.log(`  - Hoy: ${currentDay}/${currentMonth+1} | Cumple: ${entryDay}/${entryMonth+1}`)
          console.log(`  - Años: ${yearsCompleted} | Procesado: ${lastProcessed}`)
          console.log(`  - Fecha Pasada: ${isAnniversaryPassed}`)
          console.log(`  - Datos: Total ${currentTotal} vs Target ${targetTotal} | Usados ${currentUsed}`)
          console.log(`  - Should Update: ${shouldUpdate} (${reason})`)
      }

      if (shouldUpdate) {
          await prisma.vacationBalance.update({
              where: { userId: user.id },
              data: {
                  totalDays: targetTotal, 
                  usedDays: 0,             // Reinicio (Borrón y cuenta nueva)
                  pendingDays: 0,          
                  lastYearProcessed: yearsCompleted,
                  lastUpdated: new Date()
              }
          })
          updatedCount++
          if (isTargetUser) console.log(`  -> ACTUALIZADO CORRECTAMENTE`)
      }
    }

    console.log(`--- FIN SINCRONIZACIÓN. Total actualizados: ${updatedCount} ---`)
    revalidatePath('/admin/users')
    return { success: true, message: `Sincronización Completada. ${updatedCount} usuarios ajustados.` }
  } catch (error) {
    console.error("Error crítico:", error)
    return { success: false, message: "Error al sincronizar." }
  }
}

// Helper local para consistencia absoluta con el cálculo manual de años
function getDaysByYears(years: number): number {
    if (years < 1) return 0;
    
    let days = 0;
    if (years === 1) days = 12;
    else if (years === 2) days = 14;
    else if (years === 3) days = 16;
    else if (years === 4) days = 18;
    else if (years === 5) days = 20;
    else if (years >= 6 && years <= 10) days = 22;
    else if (years >= 11 && years <= 15) days = 24;
    else if (years >= 16 && years <= 20) days = 26;
    else if (years >= 21 && years <= 25) days = 28;
    else if (years >= 26 && years <= 30) days = 30;
    else days = 32;

    return days + 5; // Bono Inochem
}