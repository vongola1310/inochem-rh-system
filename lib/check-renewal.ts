import { PrismaClient } from '@prisma/client'
import { differenceInYears } from 'date-fns'
import { calculateVacationDays } from '@/lib/vacation-logic'

const prisma = new PrismaClient()

/**
 * Revisa si el empleado merece nuevos días por antigüedad.
 * Si sí, actualiza su saldo y retorna true.
 */
export async function checkAndRenewBalance(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { balance: true }
  })

  if (!user || !user.balance) return;

  // 1. Calcular antigüedad actual exacta
  const currentYearsWorked = differenceInYears(new Date(), user.entryDate)

  // 2. Verificar si ya procesamos este año
  // Ej: Si trabajó 2 años, y lastYearProcessed es 1, toca renovar.
  // Si lastYearProcessed ya es 2, no hacemos nada.
  if (currentYearsWorked > user.balance.lastYearProcessed) {
    
    // 3. Calcular cuántos días le tocan por este nuevo año
    // (Usamos tu lógica de Ley + Bono Inochem)
    const newDaysToAdd = calculateVacationDays(user.entryDate)

    console.log(`🎂 Renovando vacaciones para ${user.name}. Antigüedad: ${currentYearsWorked} años. Agregando ${newDaysToAdd} días.`)

    // 4. Actualizar en Base de Datos
    await prisma.vacationBalance.update({
      where: { userId: user.id },
      data: {
        totalDays: { increment: newDaysToAdd }, // Sumamos los días nuevos
        lastYearProcessed: currentYearsWorked,  // Marcamos este año como "pagado"
        lastUpdated: new Date()
      }
    })
  }
}