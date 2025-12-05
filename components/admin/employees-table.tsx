import { PrismaClient } from '@prisma/client'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ArrowRight, Users, Calendar, Briefcase, FileSearch, ExternalLink, TrendingUp, CheckCircle2, User } from 'lucide-react'
import { format, differenceInMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const prisma = new PrismaClient()

export async function EmployeesTable() {
  // 1. CORRECCIÓN CRÍTICA: QUITAR FILTROS
  // Eliminamos el 'where' para que traiga a TODOS los usuarios (RH, Admin, Empleados)
  const employees = await prisma.user.findMany({
    // where: { role: { not: 'HR' } }, // <--- ESTO ESTABA OCULTANDO GENTE
    include: { 
      balance: true,
      boss: { select: { name: true, jobTitle: true } }
    },
    orderBy: { name: 'asc' }
  })

  // Calcular antigüedad
  const calculateSeniority = (entryDate: Date) => {
    const months = differenceInMonths(new Date(), entryDate)
    const years = Math.floor(months / 12)
    const remainingMonths = months % 12
    
    if (years === 0) return `${remainingMonths}m`
    if (remainingMonths === 0) return `${years}a`
    return `${years}a ${remainingMonths}m`
  }

  return (
    <div className="space-y-6">
      
      {/* TARJETA SUPERIOR DE RESUMEN (Estilo Dashboard) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
         <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-500"/> Directorio de Personal
            </h2>
            <p className="text-sm text-slate-500">Lista completa de empleados activos en el sistema</p>
         </div>
         <div className="flex items-center gap-2 text-xs font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"/>
            Actualizado
         </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
           <div className="flex items-center justify-between">
              <div>
                 <CardTitle className="text-base font-bold text-slate-800">Directorio</CardTitle>
                 <CardDescription>{employees.length} empleados registrados</CardDescription>
              </div>
              <div className="flex gap-2">
                 <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600"/>
                    <div className="flex flex-col leading-none">
                       <span className="text-[10px] text-slate-500 font-bold uppercase">Activos</span>
                       <span className="text-sm font-bold text-slate-900">{employees.length}</span>
                    </div>
                 </div>
                 <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg shadow-sm">
                    <TrendingUp className="h-4 w-4 text-blue-600"/>
                    <div className="flex flex-col leading-none">
                       <span className="text-[10px] text-blue-600 font-bold uppercase">Total</span>
                       <span className="text-sm font-bold text-blue-900">{employees.length}</span>
                    </div>
                 </div>
              </div>
           </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="font-semibold text-slate-700 pl-6">Empleado</TableHead>
                <TableHead className="font-semibold text-slate-700"><div className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5"/> Puesto</div></TableHead>
                <TableHead className="font-semibold text-slate-700">Reporta A</TableHead>
                <TableHead className="text-center font-semibold text-slate-700"><div className="flex items-center justify-center gap-1"><Calendar className="h-3.5 w-3.5"/> Antigüedad</div></TableHead>
                <TableHead className="text-center font-semibold text-slate-700">Disponibles</TableHead>
                <TableHead className="text-right font-semibold text-slate-700 pr-6">Ver perfil</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-60">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                      <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                         <User className="h-8 w-8 text-slate-300" />
                      </div>
                      <div>
                         <p className="font-medium text-slate-600">No hay empleados registrados</p>
                         <p className="text-sm">Comienza registrando tu primer empleado</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((emp) => {
                  const total = emp.balance?.totalDays || 0
                  const used = emp.balance?.usedDays || 0
                  const pending = emp.balance?.pendingDays || 0
                  const available = total - used - pending
                  
                  const initials = emp.name.split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase()
                  const seniority = calculateSeniority(emp.entryDate)
                  
                  return (
                    <TableRow key={emp.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                      {/* Empleado */}
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border-2 border-slate-100">
                            <AvatarFallback className="bg-[#73C056] text-white text-xs font-bold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold text-sm text-slate-900">{emp.name}</p>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">#{emp.employeeNumber}</span>
                                {emp.role === 'HR' && <Badge className="h-4 px-1 text-[9px] bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">RH</Badge>}
                                {emp.role === 'ADMIN' && <Badge className="h-4 px-1 text-[9px] bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100">Admin</Badge>}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Puesto */}
                      <TableCell>
                        <span className="text-sm text-slate-600 font-medium">
                          {emp.jobTitle}
                        </span>
                      </TableCell>

                      {/* Reporta A */}
                      <TableCell>
                        {emp.boss ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                             <div className="h-1.5 w-1.5 rounded-full bg-blue-400"/>
                             <span className="font-medium">{emp.boss.name}</span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 font-normal border-slate-200 bg-slate-50">
                            Dirección
                          </Badge>
                        )}
                      </TableCell>

                      {/* Antigüedad */}
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-mono font-normal text-xs bg-slate-100 text-slate-600 hover:bg-slate-100">
                            {seniority}
                        </Badge>
                      </TableCell>

                      {/* Días Disponibles */}
                      <TableCell className="text-center">
                          <span className={`font-bold text-sm ${available < 0 ? 'text-red-600' : available < 5 ? 'text-amber-600' : 'text-green-600'}`}>
                             {available} días
                          </span>
                      </TableCell>

                      {/* Expediente */}
                      <TableCell className="text-right pr-6">
                        <Link href={`/admin/employees/${emp.id}`}>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-slate-500 hover:text-[#73C056] hover:bg-[#73C056]/10 font-medium"
                          >
                            Ver perfil
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}