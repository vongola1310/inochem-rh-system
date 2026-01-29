import { PrismaClient } from '@prisma/client'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { approveRequestByHR } from '@/app/actions/hr-approve'
import { CheckCircle, Users, ClipboardList, FileText, Calendar, Home, ArrowLeft, TrendingUp, Clock, Sparkles } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmployeesTable } from '@/components/admin/employees-table'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const prisma = new PrismaClient()

export default async function AdminDashboard() {
  const session = await auth()
  
  if (!session?.user) redirect('/login')
  if ((session.user as any).role !== 'HR') redirect('/')

  // 1. CONSULTA DE SOLICITUDES PENDIENTES
  const pendingRequests = await prisma.request.findMany({
    where: { 
        status: 'PENDING_HR',
        type: {
            in: ['VACATION', 'PERMIT_BIRTHDAY'] 
        }
    },
    include: { 
      user: {
        include: {
          balance: true
        }
      } 
    },
    orderBy: { createdAt: 'desc' }
  })

  // 2. NUEVA CONSULTA: OBTENER TODOS LOS EMPLEADOS PARA EL DIRECTORIO
  // Esto es necesario para pasar 'initialData' a la tabla interactiva
  const allEmployees = await prisma.user.findMany({
    include: { 
      balance: true,
      boss: { select: { name: true, jobTitle: true } }
    },
    orderBy: { name: 'asc' }
  })

  const requestTypeMap: Record<string, { label: string; icon: string; variant: string }> = {
    VACATION: { label: 'Vacaciones', icon: '🏖️', variant: 'blue' },
    PERMIT_LATE: { label: 'Llegar Tarde', icon: '⏰', variant: 'amber' },
    PERMIT_EARLY: { label: 'Salir Temprano', icon: '🏃', variant: 'purple' },
    PERMIT_ABSENCE: { label: 'Ausencia', icon: '📅', variant: 'red' },
    PERMIT_BIRTHDAY: { label: 'Cumpleaños', icon: '🎂', variant: 'pink' },
    PERMIT_OTHER: { label: 'Otro Permiso', icon: '📝', variant: 'gray' }
  }

  // Calcular solicitudes de hoy
  const todayRequests = pendingRequests.filter(r => {
    const today = new Date()
    const created = new Date(r.createdAt)
    return created.toDateString() === today.toDateString()
  }).length

  // Calcular días totales solicitados
  const totalDaysRequested = pendingRequests.reduce((sum, r) => sum + (r.daysRequested || 0), 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      {/* Header Superior Mejorado */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-lg shadow-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-300 hover:bg-slate-100 hover:border-[#73C056] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group"
              >
                <ArrowLeft className="h-4 w-4 mr-2 group-hover:text-[#73C056] transition-colors" />
                <Home className="h-4 w-4 mr-1.5 group-hover:text-[#73C056] transition-colors" />
                Volver al Inicio
              </Button>
            </Link>

            {/* Usuario Badge */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#73C056]/10 to-[#73C056]/5 px-4 py-2.5 rounded-xl border border-[#73C056]/20 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-[#73C056] animate-pulse shadow-sm shadow-[#73C056]/50"></div>
                <span className="text-slate-700 font-semibold text-sm">{session.user.name}</span>
              </div>
              <Badge className="bg-gradient-to-r from-[#73C056] to-[#62a847] text-white border-0 shadow-md hover:shadow-lg transition-all">
                Admin RH
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero Section Mejorado */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-[#73C056] via-[#62a847] to-[#73C056] rounded-2xl shadow-2xl shadow-[#73C056]/20 overflow-hidden relative">
            {/* Elementos decorativos */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24"></div>
            
            <div className="relative z-10 p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-xl">
                    <ClipboardList className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white mb-2 drop-shadow-sm">
                      Panel de Recursos Humanos
                    </h1>
                    <p className="text-white/90 text-base font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Gestión Integral de Capital Humano
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards Mejorados */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Pendientes */}
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border-0 hover:shadow-xl hover:shadow-orange-200/30 transition-all duration-300 hover:-translate-y-1 overflow-hidden group relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-500 to-orange-600"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/5 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            
            <div className="p-6 relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Solicitudes Pendientes
                  </p>
                  <p className="text-4xl font-black bg-gradient-to-r from-orange-600 to-orange-700 bg-clip-text text-transparent">
                    {pendingRequests.length}
                  </p>
                </div>
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-600/5 flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-orange-500 group-hover:to-orange-600 transition-all duration-300 shadow-sm">
                  <ClipboardList className="h-7 w-7 text-orange-600 group-hover:text-white transition-colors" />
                </div>
              </div>
              <div className="bg-orange-50 rounded-lg px-3 py-2 border border-orange-100">
                <p className="text-xs text-orange-700 font-semibold">
                  Requieren atención inmediata
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Hoy */}
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border-0 hover:shadow-xl hover:shadow-blue-200/30 transition-all duration-300 hover:-translate-y-1 overflow-hidden group relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-blue-600"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            
            <div className="p-6 relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Por Validar Hoy
                  </p>
                  <p className="text-4xl font-black bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                    {todayRequests}
                  </p>
                </div>
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-blue-600 transition-all duration-300 shadow-sm">
                  <Clock className="h-7 w-7 text-blue-600 group-hover:text-white transition-colors" />
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                <p className="text-xs text-blue-700 font-semibold">
                  {todayRequests > 0 ? 'Recibidas en las últimas 24h' : 'Todo al día'}
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Días Totales */}
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border-0 hover:shadow-xl hover:shadow-[#73C056]/20 transition-all duration-300 hover:-translate-y-1 overflow-hidden group relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#73C056] to-[#62a847]"></div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#73C056]/5 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
            
            <div className="p-6 relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Días Solicitados
                  </p>
                  <p className="text-4xl font-black bg-gradient-to-r from-[#73C056] to-[#62a847] bg-clip-text text-transparent">
                    {totalDaysRequested}
                  </p>
                </div>
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#73C056]/10 to-[#73C056]/5 flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-[#73C056] group-hover:to-[#62a847] transition-all duration-300 shadow-sm">
                  <Calendar className="h-7 w-7 text-[#73C056] group-hover:text-white transition-colors" />
                </div>
              </div>
              <div className="bg-[#73C056]/10 rounded-lg px-3 py-2 border border-[#73C056]/20">
                <p className="text-xs text-[#73C056] font-semibold">
                  Días totales en aprobación
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* PESTAÑAS DE ADMINISTRACIÓN MEJORADAS */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="inline-flex w-auto bg-white border-2 border-slate-200 p-1.5 shadow-lg rounded-xl mb-6">
            <TabsTrigger 
              value="pending" 
              className="flex items-center gap-2 px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#73C056] data-[state=active]:to-[#62a847] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#73C056]/30 transition-all duration-300 rounded-lg font-semibold"
            >
              <ClipboardList className="h-4 w-4"/>
              Por Validar
              {pendingRequests.length > 0 && (
                <Badge className="ml-2 bg-white text-[#73C056] hover:bg-white border-0 shadow-sm font-bold">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="directory" 
              className="flex items-center gap-2 px-6 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#73C056] data-[state=active]:to-[#62a847] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-[#73C056]/30 transition-all duration-300 rounded-lg font-semibold"
            >
              <Users className="h-4 w-4"/>
              Directorio
            </TabsTrigger>
          </TabsList>

          {/* PESTAÑA 1: SOLICITUDES PENDIENTES */}
          <TabsContent value="pending">
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border-0 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500/10 to-orange-500/5 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-orange-600" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">Solicitudes Pendientes de Validación</h3>
                </div>
                <p className="text-sm text-slate-600 font-medium">
                  Mostrando solo <span className="text-[#73C056] font-semibold">Vacaciones</span> y <span className="text-pink-600 font-semibold">Cumpleaños</span> 
                  <span className="text-slate-400"> (Los permisos simples se aprueban automáticamente)</span>
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 border-b-2 border-slate-200">
                      <TableHead className="font-bold text-slate-700">Empleado</TableHead>
                      <TableHead className="font-bold text-slate-700">Tipo de Solicitud</TableHead>
                      <TableHead className="font-bold text-slate-700">Fecha Inicio</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">Días</TableHead>
                      <TableHead className="font-bold text-slate-700 text-center">Saldo Disp.</TableHead>
                      <TableHead className="font-bold text-slate-700">Estado</TableHead>
                      <TableHead className="text-right font-bold text-slate-700">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-64">
                          <div className="flex flex-col items-center justify-center gap-4 text-slate-400">
                            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[#73C056]/10 to-[#73C056]/5 flex items-center justify-center">
                              <CheckCircle className="h-10 w-10 text-[#73C056]" />
                            </div>
                            <div className="text-center">
                              <p className="font-bold text-lg text-slate-700 mb-1">¡Todo al día!</p>
                              <p className="text-sm text-slate-500">No hay solicitudes pendientes de validación</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingRequests.map((req, index) => {
                        const typeInfo = requestTypeMap[req.type] || requestTypeMap['PERMIT_OTHER']
                        
                        // CÁLCULO DE SALDO DISPONIBLE EN VIVO
                        const balance = req.user.balance
                        const total = balance?.totalDays || 0
                        const used = balance?.usedDays || 0
                        const pending = balance?.pendingDays || 0
                        const available = total - used - pending

                        return (
                          <TableRow 
                            key={req.id} 
                            className="hover:bg-slate-50 transition-colors border-b border-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-300"
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-sm font-bold text-slate-700 shadow-sm">
                                  {req.user.name?.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold text-slate-900">{req.user.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2.5">
                                <span className="text-xl">{typeInfo.icon}</span>
                                <span className="text-slate-700 font-medium">{typeInfo.label}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 text-slate-700 font-medium">
                                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                  <Calendar className="h-4 w-4 text-blue-600" />
                                </div>
                                {format(req.startDate, "d 'de' MMM", { locale: es })}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-300 font-semibold px-3 py-1">
                                {req.daysRequested} {req.daysRequested === 1 ? 'día' : 'días'}
                              </Badge>
                            </TableCell>
                            
                            {/* CELDA DE SALDO DISPONIBLE MEJORADA */}
                            <TableCell className="text-center">
                              <div className="inline-flex flex-col items-center gap-1">
                                <span className={`font-black text-xl ${available < 0 ? 'text-red-600' : 'bg-gradient-to-r from-[#73C056] to-[#62a847] bg-clip-text text-transparent'}`}>
                                  {available}
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                                  días
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge className="bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-100 font-semibold shadow-sm">
                                Pendiente RH
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <form action={async () => {
                                'use server'
                                await approveRequestByHR(req.id)
                              }}>
                                <Button 
                                  size="sm" 
                                  className="bg-gradient-to-r from-[#73C056] to-[#62a847] hover:from-[#62a847] hover:to-[#73C056] text-white transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-[#73C056]/30 font-semibold"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Aprobar
                                </Button>
                              </form>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* PESTAÑA 2: DIRECTORIO */}
          <TabsContent value="directory">
            <EmployeesTable initialData={allEmployees} />
          </TabsContent>
        </Tabs>
      </div>

    </div>
  )
}