import { PrismaClient } from '@prisma/client'
import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { format, differenceInMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  CalendarDays, XCircle, CheckCircle, Clock, AlertTriangle, 
  ArrowLeft, User, Briefcase, Calendar, FileText,
  Mail, Award, BarChart3, ExternalLink, UserCog, Ban, RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { EmployeeManagementPanel } from '@/components/admin/employee-management-panel'

const prisma = new PrismaClient()

// Helper para dibujar los estados con colores exactos (Sincronizado con el resto del sistema)
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'PENDING_BOSS':
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-medium px-2 py-0.5 whitespace-nowrap">
          <Clock className="w-3 h-3 mr-1.5"/> Firma Jefe
        </Badge>
      )
    case 'PENDING_HR':
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium px-2 py-0.5 whitespace-nowrap">
          <Clock className="w-3 h-3 mr-1.5"/> Pendiente RH
        </Badge>
      )
    case 'APPROVED':
      return (
        <Badge className="bg-[#73C056]/10 text-[#73C056] border-[#73C056]/30 hover:bg-[#73C056]/20 font-medium px-2 py-0.5 whitespace-nowrap shadow-none">
          <CheckCircle className="w-3 h-3 mr-1.5"/> Aprobado
        </Badge>
      )
    case 'REJECTED':
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-medium px-2 py-0.5 whitespace-nowrap">
          <XCircle className="w-3 h-3 mr-1.5"/> Rechazado
        </Badge>
      )
    case 'CANCELLED':
      return (
        <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-medium px-2 py-0.5 whitespace-nowrap">
          <Ban className="w-3 h-3 mr-1.5"/> Cancelado
        </Badge>
      )
    case 'CANCELLATION_REQUESTED':
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-medium px-2 py-0.5 whitespace-nowrap">
            <RefreshCw className="w-3 h-3 mr-1.5"/> Pide Cancelar
          </Badge>
        )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

// Ajuste para Next.js 14: params no es una promesa
export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  // Verificación de rol: Solo RH puede ver detalles
  if ((session?.user as any)?.role !== 'HR') redirect('/')

  const { id } = params

  // Obtener datos completos del empleado
  const employee = await prisma.user.findUnique({
    where: { id },
    include: { 
      balance: true,
      boss: true,
      requests: { 
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!employee) return notFound()

  // Obtener lista de posibles jefes para el formulario de edición
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, jobTitle: true },
    orderBy: { name: 'asc' }
  })

  // Cálculos de saldos
  const total = employee.balance?.totalDays || 0
  const used = employee.balance?.usedDays || 0
  const pending = employee.balance?.pendingDays || 0
  const available = total - used - pending

  // Estadísticas
  const totalRequests = employee.requests.length
  const rejectedRequests = employee.requests.filter(r => r.status === 'REJECTED').length
  const approvedRequests = employee.requests.filter(r => r.status === 'APPROVED').length
  const approvalRate = totalRequests > 0 ? Math.round((approvedRequests / totalRequests) * 100) : 0

  // Cálculo de antigüedad
  const months = differenceInMonths(new Date(), employee.entryDate)
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  const seniority = years > 0 
    ? `${years} ${years === 1 ? 'año' : 'años'}${remainingMonths > 0 ? ` y ${remainingMonths} meses` : ''}`
    : `${remainingMonths} meses`

  // Iniciales para avatar
  const initials = employee.name
    .split(' ')
    .map(word => word.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Mapeo visual de tipos de solicitud
  const requestTypeMap: Record<string, { label: string; emoji: string; color: string }> = {
    VACATION: { label: 'Vacaciones', emoji: '🏖️', color: 'blue' },
    PERMIT_LATE: { label: 'Llegar Tarde', emoji: '⏰', color: 'amber' },
    PERMIT_EARLY: { label: 'Salir Temprano', emoji: '🏃', color: 'purple' },
    PERMIT_ABSENCE: { label: 'Ausencia', emoji: '📅', color: 'red' },
    PERMIT_BIRTHDAY: { label: 'Cumpleaños', emoji: '🎂', color: 'pink' },
    PERMIT_OTHER: { label: 'Otro Permiso', emoji: '📝', color: 'slate' }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Botón de Regreso */}
        <div className="mb-6">
          <Link href="/admin/users">
            <Button 
              variant="ghost" 
              className="text-slate-600 hover:text-[#73C056] hover:bg-[#73C056]/5 transition-all -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Directorio
            </Button>
          </Link>
        </div>
        
        {/* Header Principal */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-[#73C056]/10 flex items-center justify-center shrink-0">
              <UserCog className="h-7 w-7 text-[#73C056]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Perfil de Empleado</h1>
              <p className="text-slate-600 mt-1">Gestión individual y auditoría</p>
            </div>
          </div>

          {/* BOTONES DE GESTIÓN (EDITAR / ELIMINAR) */}
          <EmployeeManagementPanel employee={employee} bosses={allUsers} />
        </div>

        {/* Tarjeta Principal de Datos */}
        <Card className="mb-8 border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-8">
              
              {/* Avatar y Rol */}
              <div className="shrink-0 text-center md:text-left flex flex-col items-center md:items-start">
                <Avatar className="h-32 w-32 border-4 border-white shadow-xl mb-4">
                  {/* CAMBIO VISUAL: Fondo verde sólido y texto negro */}
                  <AvatarFallback className="bg-[#73C056] text-black text-3xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                
                <Badge className="bg-[#73C056]/10 text-[#73C056] border-[#73C056]/30 px-3 py-1">
                  {employee.role === 'EMPLOYEE' ? '👤 Empleado' : employee.role === 'HR' ? '👔 Recursos Humanos' : '⚙️ Administrador'}
                </Badge>
              </div>

              {/* Información Detallada */}
              <div className="flex-1 w-full">
                <h1 className="text-3xl font-bold text-slate-900 mb-2 text-center md:text-left">{employee.name}</h1>
                <p className="text-lg text-slate-600 font-medium mb-6 flex items-center justify-center md:justify-start gap-2">
                  <Briefcase className="h-5 w-5 text-[#73C056]" />
                  {employee.jobTitle}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Mail className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-500 uppercase">Correo electronico</p>
                      <p className="text-sm text-slate-900 font-medium truncate">{employee.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                      <Award className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase">No. Empleado</p>
                      <p className="text-sm text-slate-900 font-bold">#{employee.employeeNumber}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                      <Calendar className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase">Antigüedad</p>
                      <p className="text-sm text-slate-900 font-medium">{seniority}</p>
                      <p className="text-[10px] text-slate-500">Desde {format(employee.entryDate, "dd MMM yyyy", { locale: es })}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase">Reporta A</p>
                      <p className="text-sm text-slate-900 font-medium">{employee.boss?.name || 'Dirección'}</p>
                      {employee.boss?.jobTitle && <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{employee.boss.jobTitle}</p>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Widget de Saldo */}
              <div className="shrink-0 w-full md:w-auto">
                <div className={`
                  text-center p-6 rounded-xl border-4 shadow-sm
                  ${available <= 0 ? 'bg-red-50 border-red-300' : 
                    available < 5 ? 'bg-amber-50 border-amber-300' : 
                    'bg-[#73C056]/10 border-[#73C056]/40'}
                `}>
                  <CalendarDays className={`h-8 w-8 mx-auto mb-2 ${
                    available <= 0 ? 'text-red-600' : 
                    available < 5 ? 'text-amber-600' : 
                    'text-[#73C056]'
                  }`} />
                  <div className={`text-5xl font-black mb-1 ${
                    available <= 0 ? 'text-red-600' : 
                    available < 5 ? 'text-amber-600' : 
                    'text-[#73C056]'
                  }`}>
                    {available}
                  </div>
                  <p className="text-sm font-bold text-slate-700 mb-3">
                    {available === 1 ? 'Día disponible' : 'Días disponibles'}
                  </p>
                  <div className="space-y-1 pt-3 border-t border-slate-300/50">
                    <div className="flex justify-between text-xs gap-4">
                      <span className="text-slate-600">Total anual:</span>
                      <span className="font-bold text-slate-800">{total}</span>
                    </div>
                    <div className="flex justify-between text-xs gap-4">
                      <span className="text-slate-600">Usados:</span>
                      <span className="font-bold text-blue-600">-{used}</span>
                    </div>
                    <div className="flex justify-between text-xs gap-4">
                      <span className="text-slate-600">Por aprobar:</span>
                      <span className="font-bold text-orange-600">-{pending}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grid de Estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-l-4 border-slate-400 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-600">Total de solicitudes</p>
                <FileText className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-3xl font-bold text-slate-900">{totalRequests}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-[#73C056] shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-600">Aprobadas</p>
                <CheckCircle className="h-5 w-5 text-[#73C056]" />
              </div>
              <p className="text-3xl font-bold text-[#73C056]">{approvedRequests}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-red-500 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-600">Rechazadas</p>
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <p className="text-3xl font-bold text-red-600">{rejectedRequests}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-blue-500 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-600">Tasa de éxito</p>
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold text-blue-600">{approvalRate}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de Historial */}
        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-[#73C056]/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-[#73C056]" />
              </div>
              <div>
                <CardTitle className="text-xl text-slate-900">Historial de movimientos</CardTitle>
                <CardDescription>
                  Registro completo de {totalRequests} {totalRequests === 1 ? 'solicitud' : 'solicitudes'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-200">
                    <TableHead className="font-bold text-slate-700">Fecha</TableHead>
                    <TableHead className="font-bold text-slate-700">Tipo</TableHead>
                    <TableHead className="font-bold text-slate-700">Período</TableHead>
                    <TableHead className="font-bold text-slate-700 text-center">Duración</TableHead>
                    <TableHead className="font-bold text-slate-700">Estado</TableHead>
                    <TableHead className="font-bold text-slate-700">Notas</TableHead>
                    <TableHead className="font-bold text-slate-700 text-right">Ver solicitud</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-40 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                          <FileText className="h-10 w-10 text-slate-300" />
                          <p className="font-medium">Sin historial disponible</p>
                          <p className="text-sm">Este empleado aún no ha realizado solicitudes</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    employee.requests.map((req) => {
                      const typeInfo = requestTypeMap[req.type] || requestTypeMap['PERMIT_OTHER']
                      
                      return (
                        <TableRow key={req.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                          <TableCell>
                            <div className="text-sm font-medium text-slate-900">
                              {format(req.createdAt, "d MMM yyyy", { locale: es })}
                            </div>
                            <div className="text-xs text-slate-500">
                              {format(req.createdAt, "HH:mm 'hrs'")}
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{typeInfo.emoji}</span>
                              <span className="text-sm font-medium text-slate-700">{typeInfo.label}</span>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="text-sm text-slate-700">
                              {format(req.startDate, "d MMM yyyy", { locale: es })}
                            </div>
                            {req.returnDate && req.type === 'VACATION' && (
                              <div className="text-xs text-slate-500">
                                hasta {format(req.returnDate, "d MMM yyyy", { locale: es })}
                              </div>
                            )}
                          </TableCell>
                          
                          <TableCell className="text-center">
                            {req.type === 'VACATION' ? (
                              <Badge variant="outline" className="bg-slate-50 border-slate-300 text-slate-700 font-medium">
                                {req.daysRequested} {req.daysRequested === 1 ? 'día' : 'días'}
                              </Badge>
                            ) : (
                              <span className="text-sm text-slate-600 font-medium">{req.permitTime || '-'}</span>
                            )}
                          </TableCell>
                          
                          <TableCell>
                            {/* APLICAMOS LA FUNCIÓN GETSTATUSBADGE AQUÍ */}
                            {getStatusBadge(req.status)}
                          </TableCell>
                          
                          <TableCell className="max-w-[200px]">
                            {req.status === 'REJECTED' ? (
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                                <span className="text-xs text-red-700 font-medium line-clamp-2">
                                  {req.rejectionReason || 'Sin motivo'}
                                </span >
                              </div>
                            ) : (
                              <span className="text-xs text-slate-600 line-clamp-2" title={req.observations || ''}>
                                {req.observations || '-'}
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <Link href={`/dashboard/requests/${req.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 text-slate-500 hover:text-[#73C056]">
                                <ExternalLink className="h-4 w-4" />
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}