import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'
import { calculateVacationDays } from '@/lib/vacation-logic'

const prisma = new PrismaClient()

// Esta ruta se debe llamar automáticamente (ej. via Vercel Cron, GitHub Actions o un servicio externo)
// Se recomienda configurarlo para que corra una vez al día (ej. a las 00:01 AM)
export async function GET(request: Request) {
  // 1. SEGURIDAD: Verificar token secreto
  // Esto evita que cualquiera pueda ejecutar la renovación visitando la URL
  const authHeader = request.headers.get('authorization');
  
  // Debes definir CRON_SECRET en tu archivo .env con una clave segura
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'clave_secreta_default'}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const today = new Date()
  // Obtenemos mes y día actuales para comparar aniversarios
  const currentMonth = today.getMonth() + 1
  const currentDay = today.getDate()

  try {
    // 2. Buscar todos los empleados activos (excluyendo roles que no acumulen si es el caso)
    const allEmployees = await prisma.user.findMany({
      where: { role: { not: 'HR' } }, // Ajusta este filtro según tu política
      include: { balance: true }
    })

    // 3. Filtrar en memoria quiénes cumplen aniversario HOY
    // Comparamos solo día y mes de su fecha de ingreso (entryDate)
    const anniversaryEmployees = allEmployees.filter(emp => {
      const entryDate = new Date(emp.entryDate)
      return entryDate.getDate() === currentDay && (entryDate.getMonth() + 1) === currentMonth
    })

    let renewedCount = 0;
    const logs: string[] = [];

    // 4. Procesar la renovación para los cumpleañeros
    for (const emp of anniversaryEmployees) {
      // Calculamos cuántos días le tocan por su NUEVA antigüedad
      const newDays = calculateVacationDays(emp.entryDate)
      
      if (emp.balance) {
          // ACTUALIZACIÓN DE SALDO
          // Aquí asumimos que los días son acumulables (se suman a lo que ya tenía).
          // Si la política es "lo que no usaste se pierde", deberías resetear 'totalDays' en lugar de incrementar.
          await prisma.vacationBalance.update({
              where: { id: emp.balance.id },
              data: {
                  totalDays: { increment: newDays } 
              }
          })
          
          logs.push(`Renovado: ${emp.name} (Antigüedad: ${emp.entryDate.toISOString().split('T')[0]}) -> +${newDays} días agregados.`)
          renewedCount++;
      }
    }

    // 5. Retornar resultado
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