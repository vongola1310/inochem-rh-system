import { PrismaClient } from '@prisma/client'
import { differenceInYears } from 'date-fns'
import { calculateVacationDays } from '@/lib/vacation-logic' // Importamos tu lógica con bono

const prisma = new PrismaClient()

export async function checkAndRenewBalance(userId: string) {
  console.log(`[RENOVACIÓN] Iniciando chequeo para usuario ID: ${userId}`)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { balance: true }
  })

  if (!user) {
    console.log(`[RENOVACIÓN] Error: Usuario no encontrado en BD.`)
    return
  }
  
  if (!user.balance) {
    console.log(`[RENOVACIÓN] El usuario ${user.name} no tiene tabla de balance creada.`)
    return
  }

  const entryDate = new Date(user.entryDate)
  const today = new Date()
  
  // Años completos trabajados al día de hoy
  const yearsCompleted = differenceInYears(today, entryDate)

  // ¿Cuál fue el último año que el sistema procesó?
  const lastProcessedYear = user.balance.lastYearProcessed || 0

  console.log(`[RENOVACIÓN] Datos de ${user.name}:`)
  console.log(`   - Fecha de Ingreso: ${entryDate.toISOString()}`)
  console.log(`   - Fecha de Hoy: ${today.toISOString()}`)
  console.log(`   - Años Cumplidos (Calculado): ${yearsCompleted}`)
  console.log(`   - Último Año Procesado (BD): ${lastProcessedYear}`)

  // SOLO renovamos si es un año nuevo que no ha sido procesado
  // (Esto evita sobrescribir ajustes manuales si ya se marcó el año como listo)
  if (yearsCompleted > 0 && yearsCompleted > lastProcessedYear) {
    
    // Obtenemos días totales (Ley + Bono Inochem)
    const newDaysToAdd = calculateVacationDays(entryDate)

    console.log(`[RENOVACIÓN] DETECTADO NUEVO ANIVERSARIO. Procediendo a actualizar.`)
    console.log(`   - Días a asignar (Ley + Bono): ${newDaysToAdd}`)

    // AL SER UN NUEVO CICLO (ANIVERSARIO REAL):
    // 1. Establecemos el nuevo techo de días totales.
    // 2. Reiniciamos los días usados a 0 (borrón y cuenta nueva del ciclo).
    // 3. Marcamos el año como procesado.
    
    const updateResult = await prisma.vacationBalance.update({
      where: { userId: user.id },
      data: {
        totalDays: newDaysToAdd,
        usedDays: 0,             
        lastYearProcessed: yearsCompleted,
        lastUpdated: new Date()
      }
    })
    console.log(`[RENOVACIÓN] Actualización exitosa:`, updateResult)
  } else {
    console.log(`[RENOVACIÓN] No se requiere actualización. (Años cumplidos ${yearsCompleted} no es mayor a procesado ${lastProcessedYear})`)
  }
}