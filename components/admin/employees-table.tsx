import { PrismaClient } from '@prisma/client'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ArrowRight, Users, Calendar, Briefcase, FileText, Clock, TrendingUp, CheckCircle } from 'lucide-react'
import { format, differenceInMonths } from 'date-fns'
import { es } from 'date-fns/locale'

const prisma = new PrismaClient()

export async function EmployeesTable() {
  const employees = await prisma.user.findMany({
    where: { role: { not: 'HR' } },
    include: { 
      balance: true,
      boss: { select: { name: true, jobTitle: true } }
    },
    orderBy: { name: 'asc' }
  })

  const calculateSeniority = (entryDate: Date) => {
    const months = differenceInMonths(new Date(), entryDate)
    const years = Math.floor(months / 12)
    const remainingMonths = months % 12
    if (years === 0) return { text: `${remainingMonths} ${remainingMonths === 1 ? 'mes' : 'meses'}`, months }
    if (remainingMonths === 0) return { text: `${years} ${years === 1 ? 'año' : 'años'}`, months }
    return { text: `${years}a ${remainingMonths}m`, months }
  }

  const getAvailabilityStatus = (available: number) => {
    if (available <= 0) return { 
      variant: 'destructive' as const, 
      label: 'Sin días',
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200'
    }
    if (available < 5) return { 
      variant: 'secondary' as const, 
      label: `${available} días`,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200'
    }
    return { 
      variant: 'outline' as const, 
      label: `${available} días`,
      color: 'text-[#73C056]',
      bg: 'bg-[#73C056]/5',
      border: 'border-[#73C056]/20'
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      
      {/* Header con Stats */}
      <div className="p-5 border-b border-slate-200 bg-linear-to-r from-slate-50 to-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Directorio</h3>
              <p className="text-sm text-slate-500">{employees.length} empleados registrados</p>
            </div>
          </div>
          
          {/* Mini Stats */}
          <div className="flex gap-3">
            <div className="px-3 py-2 bg-[#73C056]/5 rounded-lg border border-[#73C056]/20">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[#73C056]" />
                <div>
                  <p className="text-xs text-slate-500">Activos</p>
                  <p className="text-sm font-bold text-slate-900">{employees.filter(e => e.balance).length}</p>
                </div>
              </div>
            </div>
            <div className="px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-sm font-bold text-slate-900">{employees.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla Mejorada */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
              <TableHead className="font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Empleado
                </div>
              </TableHead>
              <TableHead className="font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Puesto
                </div>
              </TableHead>
              <TableHead className="font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Reporta a
                </div>
              </TableHead>
              <TableHead className="text-center font-semibold text-slate-700">
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-4 w-4" />
                  Antigüedad
                </div>
              </TableHead>
              <TableHead className="text-center font-semibold text-slate-700">
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Disponibles
                </div>
              </TableHead>
              <TableHead className="text-right font-semibold text-slate-700">
                Ver perfil
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="h-12 w-12 text-slate-300" />
                    <p className="text-slate-500 font-medium">No hay empleados registrados</p>
                    <p className="text-sm text-slate-400">Comienza registrando tu primer empleado</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => {
                const total = emp.balance?.totalDays || 0
                const used = emp.balance?.usedDays || 0
                const pending = emp.balance?.pendingDays || 0
                const available = total - used - pending
                const status = getAvailabilityStatus(available)
                const seniority = calculateSeniority(emp.entryDate)
                
                return (
                  <TableRow 
                    key={emp.id} 
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    {/* Empleado */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-slate-100 group-hover:border-[#73C056]/30 transition-colors">
                          <AvatarFallback className="bg-linear-to-br from-[#73C056]/20 to-[#73C056]/10 text-[#73C056] font-semibold">
                            {emp.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-sm text-slate-900">{emp.name}</p>
                          <p className="text-xs text-slate-500 font-mono">#{emp.employeeNumber}</p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Puesto */}
                    <TableCell>
                      <div className="max-w-[200px]">
                        <p className="text-sm text-slate-700 font-medium truncate">{emp.jobTitle}</p>
                      </div>
                    </TableCell>

                    {/* Jefe */}
                    <TableCell>
                      {emp.boss ? (
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <span className="text-xs font-semibold text-slate-600">
                              {emp.boss.name.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-slate-700 font-medium">{emp.boss.name}</p>
                            <p className="text-xs text-slate-500">{emp.boss.jobTitle}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="text-sm text-slate-500 font-medium">Dirección</span>
                        </div>
                      )}
                    </TableCell>

                    {/* Antigüedad */}
                    <TableCell>
                      <div className="flex flex-col items-center">
                        <div className="px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                          <p className="text-sm font-semibold text-slate-900">{seniority.text}</p>
                        </div>
                        {seniority.months >= 12 && (
                          <p className="text-xs text-slate-500 mt-1">{seniority.months} meses</p>
                        )}
                      </div>
                    </TableCell>

                    {/* Días Disponibles */}
                    <TableCell>
                      <div className="flex flex-col items-center gap-1">
                        <div className={`px-4 py-2 rounded-lg border ${status.bg} ${status.border}`}>
                          <p className={`text-sm font-bold ${status.color}`}>
                            {available}
                          </p>
                        </div>
                        {emp.balance && (
                          <p className="text-xs text-slate-500">
                            de {total} días
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="text-right">
                      <Link href={`/admin/employees/${emp.id}`}>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-9 w-9 p-0 hover:bg-[#73C056]/10 hover:text-[#73C056] transition-all group-hover:scale-110"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer con info */}
      {employees.length > 0 && (
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <p>Mostrando {employees.length} empleados</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#73C056]"></div>
                <span>Disponibilidad alta</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                <span>Disponibilidad baja</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                <span>Sin días</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}