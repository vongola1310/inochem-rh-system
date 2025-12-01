import { PrismaClient } from '@prisma/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Clock, CheckCircle, XCircle, FileText, Calendar, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const prisma = new PrismaClient()

// Función auxiliar para traducir estados y colores
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'PENDING_BOSS':
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-medium">
          <Clock className="w-3 h-3 mr-1.5"/> Pendiente Jefe
        </Badge>
      )
    case 'PENDING_HR':
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 font-medium">
          <AlertCircle className="w-3 h-3 mr-1.5"/> Pendiente RH
        </Badge>
      )
    case 'APPROVED':
      return (
        <Badge className="bg-[#73C056] hover:bg-[#62a847] font-medium shadow-sm">
          <CheckCircle className="w-3 h-3 mr-1.5"/> Aprobado
        </Badge>
      )
    case 'REJECTED':
      return (
        <Badge variant="destructive" className="font-medium shadow-sm">
          <XCircle className="w-3 h-3 mr-1.5"/> Rechazado
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

const getTypeLabel = (type: string) => {
  if (type === 'VACATION') return 'Vacaciones'
  if (type.startsWith('PERMIT')) return 'Permiso'
  return type
}

const getTypeIcon = (type: string) => {
  if (type === 'VACATION') return '🏖️'
  if (type.startsWith('PERMIT')) return '📋'
  return '📄'
}

export async function RequestHistory({ userId }: { userId: string }) {
  // Buscamos las últimas 5 solicitudes
  const requests = await prisma.request.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5
  })

  return (
    <Card className="mt-8 border-slate-200 shadow-sm">
      <CardHeader className="bg-linear-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#73C056]/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-[#73C056]" />
            </div>
            Historial Reciente
          </CardTitle>
          {requests.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {requests.length} {requests.length === 1 ? 'solicitud' : 'solicitudes'}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Vista Desktop - Tabla */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="font-semibold text-slate-700">Tipo</TableHead>
                <TableHead className="font-semibold text-slate-700">Fecha Solicitada</TableHead>
                <TableHead className="font-semibold text-slate-700">Estado</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">Enviado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <FileText className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-slate-600 font-medium">No has realizado solicitudes aún</p>
                      <p className="text-sm text-slate-500 mt-1">Tus solicitudes aparecerán aquí</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getTypeIcon(req.type)}</span>
                        {getTypeLabel(req.type)}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        {format(req.startDate, "dd MMM yyyy", { locale: es })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(req.status)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-500">
                      {format(req.createdAt, "dd/MM/yy", { locale: es })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Vista Mobile - Cards */}
        <div className="md:hidden">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-8">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No has realizado solicitudes aún</p>
              <p className="text-sm text-slate-500 mt-1">Tus solicitudes aparecerán aquí</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {requests.map((req) => (
                <div key={req.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getTypeIcon(req.type)}</span>
                      <div>
                        <p className="font-semibold text-slate-900">{getTypeLabel(req.type)}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {format(req.startDate, "dd MMM yyyy", { locale: es })}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(req.status)}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500">Enviado el</p>
                    <p className="text-xs font-medium text-slate-700">
                      {format(req.createdAt, "dd/MM/yy", { locale: es })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}