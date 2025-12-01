'use server'

import { PrismaClient } from '@prisma/client'
import { format, differenceInYears } from 'date-fns'
import { getCyclePeriod } from '@/lib/vacation-logic'

const prisma = new PrismaClient()

// REPORTE 1: SALDOS GLOBAL / GRUPAL (CON FILTRO DE PERIODO)
export async function getBalanceReport(
  jobTitleFilter?: string, 
  startDateStr?: string, 
  endDateStr?: string
) {
  const whereClause: any = { role: { not: 'HR' } }
  
  if (jobTitleFilter && jobTitleFilter !== 'ALL') {
    whereClause.jobTitle = { contains: jobTitleFilter, mode: 'insensitive' }
  }

  const employees = await prisma.user.findMany({
    // @ts-ignore
    where: whereClause,
    include: { 
        balance: true, 
        boss: true,
        requests: {
            where: {
                status: 'APPROVED',
                type: 'VACATION'
            }
        }
    },
    orderBy: { name: 'asc' }
  })

  // 1. CORRECCIÓN DE FECHAS: Usamos UTC (Z) para evitar desfases de zona horaria
  // Si no hay fecha, usamos un rango muy amplio por defecto
  const start = startDateStr ? new Date(startDateStr + 'T00:00:00Z') : new Date('2000-01-01T00:00:00Z')
  const end = endDateStr ? new Date(endDateStr + 'T23:59:59Z') : new Date()

  // Mapeamos los datos
  const reportData = (employees as any[]).map(emp => {
    const total = emp.balance?.totalDays || 0
    const pending = emp.balance?.pendingDays || 0
    
    // 2. CÁLCULO MÁS ROBUSTO
    // Filtramos las solicitudes aprobadas que caigan dentro del rango
    const requestsInPeriod = emp.requests.filter((r: any) => {
        // Convertimos la fecha de la solicitud a objeto Date para comparar
        const rDate = new Date(r.startDate)
        // Comparación simple de timestamps
        return rDate.getTime() >= start.getTime() && rDate.getTime() <= end.getTime()
    })
    
    const usedInPeriod = requestsInPeriod.reduce((sum: number, r: any) => sum + (r.daysRequested || 0), 0)
    
    const globalUsed = emp.balance?.usedDays || 0
    const available = total - globalUsed - pending

    const antiquity = differenceInYears(new Date(), emp.entryDate)
    const period = getCyclePeriod(emp.entryDate)

    return {
      "id": emp.id, 
      "No. Empleado": emp.employeeNumber,
      "Nombre Completo": emp.name,
      "Puesto": emp.jobTitle,
      "Jefe Inmediato": emp.boss?.name || 'Dirección',
      "Fecha Ingreso": format(new Date(emp.entryDate), 'dd/MM/yyyy'),
      "Antigüedad": `${antiquity} años`,
      "Vigencia Actual": period.label,
      "Días Totales": total,
      // Si se filtró por fecha, mostramos lo usado en ese periodo. Si no, el histórico global.
      [`Vacaciones Tomadas (${startDateStr ? 'Periodo' : 'Histórico'})`]: startDateStr ? usedInPeriod : globalUsed,
      "Por Autorizar": pending,
      "Saldo Disponible": available,
      // Campo auxiliar interno para filtrar
      _usedInPeriod: usedInPeriod 
    }
  })

  // 3. FILTRADO DE FILAS (Lo que pediste)
  // Si el usuario seleccionó un rango de fechas específico (diferente al default histórico),
  // filtramos la lista para mostrar SOLO a los que tuvieron actividad (vacaciones > 0).
  if (startDateStr && endDateStr) {
      return reportData.filter(item => item._usedInPeriod > 0)
  }

  return reportData
}

// REPORTE 2: MOVIMIENTOS POR PERIODO
export async function getMovementReport(startDateStr: string, endDateStr: string) {
  // Corrección de zonas horarias también aquí
  const start = new Date(startDateStr + 'T00:00:00Z')
  const end = new Date(endDateStr + 'T23:59:59Z')

  const requests = await prisma.request.findMany({
    where: {
        createdAt: { gte: start, lte: end }
    },
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  })

  return requests.map(req => ({
    "Folio": req.id.slice(-6),
    "Empleado": req.user.name,
    "Tipo Solicitud": req.type === 'VACATION' ? 'Vacaciones' : 'Permiso',
    "Fecha Solicitud": format(new Date(req.createdAt), 'dd/MM/yyyy HH:mm'),
    "Fecha Inicio": format(new Date(req.startDate), 'dd/MM/yyyy'),
    "Fecha Fin": req.returnDate ? format(new Date(req.returnDate), 'dd/MM/yyyy') : 'N/A',
    "Días/Horas": req.type === 'VACATION' ? req.daysRequested : (req.permitTime || '1 día'),
    "Estado Final": req.status,
    "Observaciones": req.observations || '-',
    "Aprobado por Jefe": req.approvedByBoss && req.bossApprovalDate ? format(new Date(req.bossApprovalDate), 'dd/MM/yyyy') : 'Pendiente',
    "Validado por RH": req.approvedByHR && req.hrApprovalDate ? format(new Date(req.hrApprovalDate), 'dd/MM/yyyy') : 'Pendiente',
  }))
}