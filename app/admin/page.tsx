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
import { runAutoApprovalCheck } from '@/app/actions/auto-approve-managers' 
import { CheckCircle, Users, ClipboardList, FileText, Calendar, Home, ArrowLeft, Zap } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmployeesTable } from '@/components/admin/employees-table'
import { formatUTC, formatMXTime, formatMXDate } from '@/lib/format-date'

const prisma = new PrismaClient()

export default async function AdminDashboard() {
  const session = await auth()
  
  if (!session?.user) redirect('/login')
  if ((session.user as any).role !== 'HR') redirect('/')

  // 1. CONSULTA DE SOLICITUDES PENDIENTES CON SALDO
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

  // 2. CONSULTA DE EMPLEADOS (Para el Directorio y Buscador)
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

  return (
    <div className="p-6 md:p-8 bg-linear-to-br from-slate-50 via-slate-100 to-slate-50 min-h-screen">
      
      {/* BARRA SUPERIOR */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Link href="/">
          <Button 
            variant="outline" 
            className="border-slate-300 hover:bg-slate-100 hover:border-[#73C056] transition-all duration-200 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:text-[#73C056] transition-colors" />
            <Home className="h-4 w-4 mr-1.5 group-hover:text-[#73C056] transition-colors" />
            Volver al Panel Principal
          </Button>
        </Link>

        {/* BOTÓN: AUTO-VALIDAR GERENTES */}
        <form action={async () => {
            'use server'
            await runAutoApprovalCheck()
        }}>
            <Button 
                type="submit"
                className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all border border-indigo-700"
                title="Aprobar automáticamente solicitudes de Gerentes con más de 3 días sin respuesta"
            >
                <Zap className="h-4 w-4 mr-2 text-yellow-300" />
                Auto-Validar Gerentes (3 días)
            </Button>
        </form>
      </div>

      {/* HEADER */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-[#73C056]/10 flex items-center justify-center">
              <ClipboardList className="h-6 w-6 text-[#73C056]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Panel de Recursos Humanos</h1>
              <p className="text-sm text-slate-500">Gestión de Capital Humano</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-sm bg-white px-4 py-2.5 rounded-lg shadow-sm border border-slate-200">
                <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#73C056] animate-pulse"></div>
                <span className="text-slate-600 font-medium">{session.user.name}</span>
                </div>
                <Badge className="bg-[#73C056]/10 text-[#73C056] border-[#73C056]/20 hover:bg-[#73C056]/20">
                Admin RH
                </Badge>
            </div>
          </div>
        </div>

        {/* TARJETAS DE ESTADÍSTICAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Solicitudes Pendientes</p>
                <p className="text-2xl font-bold text-slate-900">{pendingRequests.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Por Validar Hoy</p>
                <p className="text-2xl font-bold text-slate-900">
                  {pendingRequests.filter(r => {
                    const today = new Date()
                    const created = new Date(r.createdAt)
                    return created.toDateString() === today.toDateString()
                  }).length}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Días Solicitados</p>
                <p className="text-2xl font-bold text-slate-900">
                  {pendingRequests.reduce((sum, r) => sum + (r.daysRequested || 0), 0)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-[#73C056]/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-[#73C056]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6 bg-white border border-slate-200 p-1 shadow-sm">
          <TabsTrigger 
            value="pending" 
            className="flex items-center gap-2 data-[state=active]:bg-[#73C056] data-[state=active]:text-white transition-all"
          >
            <ClipboardList className="h-4 w-4"/>
            Por Validar
            {pendingRequests.length > 0 && (
              <Badge className="ml-1 bg-white text-[#73C056] hover:bg-white">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="directory" 
            className="flex items-center gap-2 data-[state=active]:bg-[#73C056] data-[state=active]:text-white transition-all"
          >
            <Users className="h-4 w-4"/>
            Directorio
          </TabsTrigger>
        </TabsList>

        {/* PESTAÑA 1: SOLICITUDES PENDIENTES */}
        <TabsContent value="pending">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-linear-to-r from-slate-50 to-white">
              <h3 className="font-semibold text-slate-900">Solicitudes Pendientes de Validación</h3>
              <p className="text-sm text-slate-500 mt-1">
                Mostrando solo Vacaciones y Cumpleaños.
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="font-semibold text-slate-700">Empleado</TableHead>
                    <TableHead className="font-semibold text-slate-700">Tipo</TableHead>
                    <TableHead className="font-semibold text-slate-700">Fecha Inicio</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center">Días</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center">Saldo Disp.</TableHead>
                    <TableHead className="font-semibold text-slate-700">Estado</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-32">
                        <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                          <CheckCircle className="h-12 w-12" />
                          <p className="font-medium">No hay solicitudes pendientes</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingRequests.map((req) => {
                      const typeInfo = requestTypeMap[req.type] || requestTypeMap['PERMIT_OTHER']
                      
                      // CÁLCULO DE SALDO EN TIEMPO REAL
                      const balance = req.user.balance
                      const total = balance?.totalDays || 0
                      const used = balance?.usedDays || 0
                      const pending = balance?.pendingDays || 0
                      const available = total - used - pending

                      return (
                        <TableRow key={req.id} className="hover:bg-slate-50 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
                                {req.user.name?.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-slate-900">{req.user.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{typeInfo.icon}</span>
                              <span className="text-slate-700">{typeInfo.label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-slate-700">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {formatUTC(req.startDate, "d 'de' MMM")}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-300">
                              {req.daysRequested}
                            </Badge>
                          </TableCell>
                          
                          {/* COLUMNA DE SALDO DISPONIBLE */}
                          <TableCell className="text-center">
                             <span className={`font-bold text-sm ${available < 0 ? 'text-red-600' : 'text-[#73C056]'}`}>
                                {available} días
                             </span>
                          </TableCell>

                          <TableCell>
                            <Badge className="bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100">
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
                                className="bg-[#73C056] hover:bg-[#62a847] text-white transition-colors shadow-sm"
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
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
  )
}