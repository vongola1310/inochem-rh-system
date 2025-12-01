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
  Mail, Award, BarChart3, ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"

const prisma = new PrismaClient()

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'HR') redirect('/')

  const { id } = await params

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

  const total = employee.balance?.totalDays || 0
  const used = employee.balance?.usedDays || 0
  const pending = employee.balance?.pendingDays || 0
  const available = total - used - pending

  const totalRequests = employee.requests.length
  const rejectedRequests = employee.requests.filter(r => r.status === 'REJECTED').length
  const approvedRequests = employee.requests.filter(r => r.status === 'APPROVED').length
  const approvalRate = totalRequests > 0 ? Math.round((approvedRequests / totalRequests) * 100) : 0

  const months = differenceInMonths(new Date(), employee.entryDate)
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  const seniority = years > 0 
    ? `${years} ${years === 1 ? 'año' : 'años'}${remainingMonths > 0 ? ` y ${remainingMonths} meses` : ''}`
    : `${remainingMonths} meses`

  const initials = employee.name
    .split(' ')
    .map(word => word.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const requestTypeMap: Record<string, { label: string; emoji: string; color: string }> = {
    VACATION: { label: 'Vacaciones', emoji: '🏖️', color: 'blue' },
    PERMIT_LATE: { label: 'Llegar Tarde', emoji: '⏰', color: 'amber' },
    PERMIT_EARLY: { label: 'Salir Temprano', emoji: '🏃', color: 'purple' },
    PERMIT_ABSENCE: { label: 'Ausencia', emoji: '📅', color: 'red' },
    PERMIT_BIRTHDAY: { label: 'Cumpleaños', emoji: '🎂', color: 'pink' },
    PERMIT_OTHER: { label: 'Otro Permiso', emoji: '📝', color: 'slate' }
  }

  return (
    <div className="p-8 bg-linear-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
      
      <div className="mb-8">
        <Link href="/admin/users">
          <Button variant="outline" className="gap-2 mb-4 border-slate-300 hover:border-[#73C056] hover:bg-[#73C056]/5 transition-all">
            <ArrowLeft className="h-4 w-4" />
            Volver al Directorio
          </Button>
        </Link>
        
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Panel de RH</span>
          <span>•</span>
          <span>Directorio de Empleados</span>
          <span>•</span>
          <span className="text-[#73C056] font-semibold">Perfil Detallado</span>
        </div>
      </div>

      <Card className="mb-6 border-slate-200 shadow-lg overflow-hidden">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="shrink-0 text-center md:text-left">
              <Avatar className="h-32 w-32 mx-auto md:mx-0 border-4 border-white shadow-xl mb-4">
                <AvatarFallback className="bg-linear-to-br from-[#73C056] to-[#62a847] text-white text-3xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              
              <Badge className="bg-[#73C056]/10 text-[#73C056] border-[#73C056]/30 px-3 py-1">
                {employee.role === 'EMPLOYEE' ? '👤 Empleado' : employee.role === 'HR' ? '👔 Recursos Humanos' : '⚙️ Administrador'}
              </Badge>
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">{employee.name}</h1>
              <p className="text-lg text-slate-600 font-medium mb-4 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-[#73C056]" />
                {employee.jobTitle}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Email Corporativo</p>
                    <p className="text-sm text-slate-900 font-medium truncate">{employee.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Award className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">No. Empleado</p>
                    <p className="text-sm text-slate-900 font-bold">#{employee.employeeNumber}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Antigüedad</p>
                    <p className="text-sm text-slate-900 font-medium">{seniority}</p>
                    <p className="text-xs text-slate-500">Desde {format(employee.entryDate, "MMM yyyy", { locale: es })}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <User className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Reporta A</p>
                    <p className="text-sm text-slate-900 font-medium">{employee.boss?.name || 'Dirección'}</p>
                    {employee.boss?.jobTitle && <p className="text-xs text-slate-500">{employee.boss.jobTitle}</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <div className={`
                text-center p-6 rounded-xl border-4 shadow-lg
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
                  {available === 1 ? 'Día Disponible' : 'Días Disponibles'}
                </p>
                <div className="space-y-1 pt-3 border-t border-slate-300">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Total:</span>
                    <span className="font-bold text-slate-800">{total}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Usados:</span>
                    <span className="font-bold text-blue-600">-{used}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Por autorizar:</span>
                    <span className="font-bold text-orange-600">-{pending}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="border-l-4 border-slate-400 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <FileText className="h-8 w-8 text-slate-500" />
              <span className="text-3xl">📊</span>
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-1">Total de Solicitudes</p>
            <p className="text-4xl font-bold text-slate-900">{totalRequests}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-[#73C056] shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="h-8 w-8 text-[#73C056]" />
              <span className="text-3xl">✅</span>
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-1">Aprobadas</p>
            <p className="text-4xl font-bold text-[#73C056]">{approvedRequests}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-red-500 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <span className="text-3xl">❌</span>
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-1">Rechazadas</p>
            <p className="text-4xl font-bold text-red-600">{rejectedRequests}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-blue-500 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <BarChart3 className="h-8 w-8 text-blue-500" />
              <span className="text-3xl">📈</span>
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-1">Tasa de Éxito</p>
            <p className="text-4xl font-bold text-blue-600">{approvalRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="bg-linear-to-r from-slate-50 to-blue-50/50 border-b-2 border-[#73C056]/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-[#73C056]/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-[#73C056]" />
              </div>
              <div>
                <CardTitle className="text-xl text-slate-900">📋 Historial de Movimientos</CardTitle>
                <CardDescription className="text-slate-600">
                  Registro completo de {totalRequests} {totalRequests === 1 ? 'solicitud' : 'solicitudes'}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-bold text-slate-700">📅 Fecha</TableHead>
                <TableHead className="font-bold text-slate-700">📝 Tipo</TableHead>
                <TableHead className="font-bold text-slate-700">🗓️ Período</TableHead>
                <TableHead className="font-bold text-slate-700 text-center">⏱️ Duración</TableHead>
                <TableHead className="font-bold text-slate-700">🚦 Estado</TableHead>
                <TableHead className="font-bold text-slate-700">💬 Notas</TableHead>
                <TableHead className="font-bold text-slate-700 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employee.requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-6xl mb-3">📭</span>
                      <p className="text-lg font-semibold text-slate-600">Sin historial disponible</p>
                      <p className="text-sm text-slate-500">Este empleado aún no ha realizado solicitudes</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                employee.requests.map((req) => {
                  const typeInfo = requestTypeMap[req.type] || requestTypeMap['PERMIT_OTHER']
                  
                  return (
                    <TableRow key={req.id} className="hover:bg-blue-50/30 transition-colors border-b border-slate-100">
                      <TableCell>
                        <div className="text-sm font-semibold text-slate-800">
                          {format(req.createdAt, "d MMM yyyy", { locale: es })}
                        </div>
                        <div className="text-xs text-slate-500">
                          {format(req.createdAt, "HH:mm 'hrs'")}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{typeInfo.emoji}</span>
                          <span className="text-sm font-medium text-slate-700">{typeInfo.label}</span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm font-medium text-slate-800">
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
                          <Badge className="bg-slate-100 text-slate-700 border border-slate-300 font-bold">
                            {req.daysRequested} {req.daysRequested === 1 ? 'día' : 'días'}
                          </Badge>
                        ) : (
                          <span className="text-sm text-slate-600 font-medium">{req.permitTime || '-'}</span>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        {req.status === 'APPROVED' && (
                          <Badge className="bg-[#73C056] text-white hover:bg-[#62a847] font-semibold shadow-sm">
                            ✓ Aprobado
                          </Badge>
                        )}
                        {req.status === 'REJECTED' && (
                          <Badge className="bg-red-500 text-white hover:bg-red-600 font-semibold shadow-sm">
                            ✗ Rechazado
                          </Badge>
                        )}
                        {(req.status === 'PENDING_BOSS' || req.status === 'PENDING_HR') && (
                          <Badge className="bg-amber-500 text-white hover:bg-amber-600 font-semibold shadow-sm">
                            ⏳ Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      
                      <TableCell className="max-w-[250px]">
                        {req.status === 'REJECTED' ? (
                          <div className="flex items-start gap-2 bg-red-50 p-2 rounded-lg border border-red-200">
                            <span className="text-lg">⚠️</span>
                            <span className="text-xs text-red-700 font-medium">
                              {req.rejectionReason || 'Sin motivo especificado'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600 line-clamp-2">
                            {req.observations || 'Sin observaciones'}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <Link href={`/dashboard/requests/${req.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 text-slate-500">
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
        </CardContent>
      </Card>
    </div>
  )
}