'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { calculateVacationDays } from '@/lib/vacation-logic'
import { differenceInYears } from 'date-fns'

const prisma = new PrismaClient()

export async function syncAllBalances() {
  try {
    const employees = await prisma.user.findMany({
      where: { role: { not: 'HR' } },
      include: { balance: true }
    })

    let updatedCount = 0

    for (const emp of employees) {
      if (!emp.balance) continue;

      // 1. Calcular antigüedad real a hoy
      const yearsWorked = differenceInYears(new Date(), emp.entryDate)
      
      // 2. Calcular cuántos días le tocan por ley/política para SU NIVEL ACTUAL
      // (Ojo: Esto reemplazará el saldo total con el teórico. Si quieres respetar días acumulados, la lógica sería distinta)
      const correctTotalDays = calculateVacationDays(emp.entryDate)

      // 3. Actualizar la BD para que quede sincronizada
      await prisma.vacationBalance.update({
        where: { id: emp.balance.id },
        data: {
          // Opción A: Solo corregimos el "puntero" para que no se dupliquen a futuro
          lastYearProcessed: yearsWorked,
          
          // Opción B (Descomenta si quieres REINICIAR el saldo de todos al valor correcto por antigüedad)
          // totalDays: correctTotalDays, 
        }
      })
      updatedCount++
    }

    revalidatePath('/admin/users')
    return { success: true, message: `Sincronizados ${updatedCount} empleados correctamente.` }

  } catch (error) {
    console.error(error)
    return { success: false, message: "Error al sincronizar." }
  }
}