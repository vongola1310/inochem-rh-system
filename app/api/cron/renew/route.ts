import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { calculateVacationDays } from '@/lib/vacation-logic'
import { differenceInYears } from 'date-fns'

// IMPORTANTE: Esto evita que Next.js intente pre-renderizar esta ruta en el build
export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  // 1. SEGURIDAD: Verificar token secreto
  // Esto evita que cualquiera pueda ejecutar la renovación visitando la URL
  const authHeader = request.headers.get('authorization');
  
  // Debes definir CRON_SECRET en tu archivo .env (y en Vercel) con una clave segura
  // Si no la tienes definida aún, usa una por defecto temporalmente o configúrala ya.
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'clave_secreta_default'}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const today = new Date()
  // Usamos getMonth() + 1 porque en JS los meses van de 0 a 11
  const currentMonth = today.getMonth() + 1
  const currentDay = today.getDate()

  try {
    // 2. Buscar todos los empleados activos (excluyendo roles que no acumulen si es el caso)
    const allEmployees = await prisma.user.findMany({
      where: { role: { not: 'HR' } }, 
      include: { balance: true }
    })

    // 3. Filtrar en memoria quiénes cumplen aniversario HOY
    const anniversaryEmployees = allEmployees.filter(emp => {
      const entryDate = new Date(emp.entryDate)
      // Comparamos solo día y mes de su fecha de ingreso
      // Al usar T12:00:00Z en el registro, getDate() funciona bien en la mayoría de zonas horarias.
      return entryDate.getDate() === currentDay && (entryDate.getMonth() + 1) === currentMonth
    })

    let renewedCount = 0;
    const logs: string[] = [];

    // 4. Procesar la renovación
    for (const emp of anniversaryEmployees) {
      // Calculamos la antigüedad exacta que cumple HOY
      const yearsWorked = differenceInYears(today, emp.entryDate)
      
      // Solo renovamos si no se ha procesado este año todavía
      // Verificamos que emp.balance no sea null y que el año procesado sea menor al actual
      if (emp.balance && emp.balance.lastYearProcessed < yearsWorked) {
          
          // Calculamos cuántos días le tocan por este nuevo año (Ley + Bono)
          const newDays = calculateVacationDays(emp.entryDate)
          
          await prisma.vacationBalance.update({
              where: { id: emp.balance.id },
              data: {
                  totalDays: { increment: newDays }, // Sumamos al saldo acumulado
                  lastYearProcessed: yearsWorked     // Marcamos este año como pagado
              }
          })
          
          logs.push(`Renovado: ${emp.name} (Antigüedad: ${yearsWorked} años) -> +${newDays} días.`)
          renewedCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Proceso finalizado. Se renovaron ${renewedCount} empleados.`,
      details: logs 
    })

  } catch (error) {
    console.error("Error crítico en Cron Job:", error)
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 })
  }
}