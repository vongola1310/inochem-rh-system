import { PrismaClient } from '@prisma/client'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, FileText, CheckCircle, XCircle, Clock, Users, ExternalLink } from 'lucide-react'
import { formatUTC, formatMXTime, formatMXDate } from '@/lib/format-date'
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const prisma = new PrismaClient()

export default async function TeamHistoryPage() {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')

  // 1. Obtener al jefe y su lista de subordinados
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { subordinates: true }
  })

  if (!user) return redirect('/')
  
  // 2. Seguridad: Si no tiene gente a cargo, lo sacamos
  if (user.subordinates.length === 0) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow text-center max-w-md">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-4"/>
                <h1 className="text-xl font-bold text-slate-800 mb-2">Acceso Restringido</h1>
                <p className="text-slate-500 mb-6">Esta sección es exclusiva para líderes con personal a cargo.</p>
                <Link href="/"><Button>Volver al Inicio</Button></Link>
            </div>
        </div>
    )
  }

  // 3. Obtener los IDs de los empleados
  const subordinateIds = user.subordinates.map(s => s.id)

  // 4. Buscar TODAS las solicitudes de esos empleados
  const requests = await prisma.request.findMany({
    where: {
        userId: { in: subordinateIds }
    },
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  })

  // Mapa de tipos para visualización
  const requestTypeMap: Record<string, { label: string; emoji: string }> = {
    VACATION: { label: 'Vacaciones', emoji: '🏖️' },
    PERMIT_LATE: { label: 'Llegar Tarde', emoji: '⏰' },
    PERMIT_EARLY: { label: 'Salir Temprano', emoji: '🏃' },
    PERMIT_ABSENCE: { label: 'Ausencia', emoji: '📅' },
    PERMIT_BIRTHDAY: { label: 'Cumpleaños', emoji: '🎂' },
    PERMIT_OTHER: { label: 'Otro Permiso', emoji: '📝' }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
            <Link href="/">
                <Button variant="ghost" className="mb-4 pl-0 hover:bg-transparent text-slate-500 hover:text-slate-900">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Volver al Dashboard
                </Button>
            </Link>
            <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-blue-100 flex items-center justify-center shadow-sm">
                    <Users className="h-7 w-7 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Historial del Equipo</h1>
                    <p className="text-slate-500">Supervisión de solicitudes de tus {user.subordinates.length} colaboradores</p>
                </div>
            </div>
        </div>

        {/* Tabla */}
        <Card className="shadow-md border-slate-200 overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-white">
                <CardTitle className="text-lg flex justify-between items-center">
                    <span>Registro de Movimientos</span>
                    <Badge variant="outline" className="font-normal text-slate-500">
                        {requests.length} registros
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                            <TableHead className="pl-6 font-bold text-slate-700">Empleado</TableHead>
                            <TableHead className="font-bold text-slate-700">Tipo</TableHead>
                            <TableHead className="font-bold text-slate-700">Fecha del Evento</TableHead>
                            <TableHead className="text-center font-bold text-slate-700">Días/Hrs</TableHead>
                            <TableHead className="font-bold text-slate-700">Estado</TableHead>
                            <TableHead className="text-right pr-6 font-bold text-slate-700">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-40 text-center text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <FileText className="h-8 w-8 text-slate-300"/>
                                        <p>Tu equipo aún no ha generado solicitudes.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            requests.map(req => {
                                const typeInfo = requestTypeMap[req.type] || requestTypeMap['PERMIT_OTHER']
                                // FIX: Convertimos a string para evitar conflictos de tipado si Prisma no está actualizado
                                const statusStr = req.status as string; 
                                
                                return (
                                    <TableRow key={req.id} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="pl-6 font-medium">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9 border border-slate-200 bg-white">
                                                    <AvatarFallback className="bg-slate-100 text-slate-700 font-bold text-xs">
                                                        {req.user.name.charAt(0)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="text-slate-900 font-semibold">{req.user.name}</span>
                                                    <span className="text-[10px] text-slate-500 uppercase">{req.user.jobTitle || 'Colaborador'}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{typeInfo.emoji}</span>
                                                <span className="text-sm text-slate-600 font-medium">{typeInfo.label}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-600">
                                            {formatUTC(req.startDate, "d 'de' MMM")} 
                                            {req.returnDate && req.type === 'VACATION' && ` - ${formatUTC(req.returnDate, "d 'de' MMM")}`}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className="font-normal bg-slate-100 text-slate-700">
                                                {req.type === 'VACATION' ? req.daysRequested : (req.permitTime || '1')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={`
                                                ${statusStr === 'APPROVED' ? 'bg-[#73C056]/10 text-[#73C056] border-[#73C056]/20' : ''}
                                                ${statusStr === 'REJECTED' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                                                ${statusStr === 'PENDING_BOSS' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                                                ${statusStr === 'PENDING_HR' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                                                ${statusStr === 'CANCELLED' ? 'bg-slate-100 text-slate-500 border-slate-200' : ''}
                                                ${statusStr === 'CANCELLATION_REQUESTED' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''}
                                                shadow-none hover:bg-opacity-80 border font-medium px-2 py-0.5
                                            `}>
                                                {statusStr === 'APPROVED' && <CheckCircle className="w-3 h-3 mr-1"/>}
                                                {statusStr === 'REJECTED' && <XCircle className="w-3 h-3 mr-1"/>}
                                                {(statusStr === 'PENDING_BOSS' || statusStr === 'PENDING_HR') && <Clock className="w-3 h-3 mr-1"/>}
                                                
                                                {statusStr === 'APPROVED' ? 'Aprobado' : 
                                                 statusStr === 'REJECTED' ? 'Rechazado' : 
                                                 statusStr === 'PENDING_BOSS' ? 'Por Autorizar' : 
                                                 statusStr === 'PENDING_HR' ? 'Pendiente de RH' :
                                                 statusStr === 'CANCELLED' ? 'Cancelado' : 
                                                 statusStr === 'CANCELLATION_REQUESTED' ? 'Solicita Cancelación' : statusStr}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Link href={`/dashboard/requests/${req.id}`}>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-blue-50 text-slate-400 hover:text-blue-600">
                                                    <ExternalLink className="h-4 w-4"/>
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
    </div>
  )
}