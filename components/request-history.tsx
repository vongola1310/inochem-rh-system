import { prisma } from '@/lib/prisma' // Usamos el Singleton para evitar errores de conexión
import { formatUTC, formatMXTime, formatMXDate } from '@/lib/format-date'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Clock, CheckCircle, XCircle, FileText, Calendar, AlertCircle, ChevronRight, Ban, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Función auxiliar para traducir estados y colores (Diseño Mejorado)
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
          <Clock className="w-3 h-3 mr-1.5"/> Revisión RH
        </Badge>
      )
    case 'APPROVED':
      return (
        <Badge className="bg-[#73C056]/10 text-[#73C056] border border-[#73C056]/20 font-medium shadow-none hover:bg-[#73C056]/20 px-2 py-0.5 whitespace-nowrap">
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

const getTypeLabel = (type: string) => {
  if (type === 'VACATION') return 'Vacaciones'
  if (type === 'PERMIT_LATE') return 'Llegada Tarde'
  if (type === 'PERMIT_EARLY') return 'Salida Temprana'
  if (type === 'PERMIT_ABSENCE') return 'Falta Justificada'
  if (type === 'PERMIT_BIRTHDAY') return 'Cumpleaños'
  return 'Permiso'
}

const getTypeIcon = (type: string) => {
  if (type === 'VACATION') return <div className="p-1.5 bg-blue-100 rounded-md text-blue-600"><Calendar className="w-4 h-4"/></div>
  if (type === 'PERMIT_BIRTHDAY') return <div className="p-1.5 bg-pink-100 rounded-md text-pink-600"><span className="text-sm">🎂</span></div>
  return <div className="p-1.5 bg-slate-100 rounded-md text-slate-600"><FileText className="w-4 h-4"/></div>
}

export async function RequestHistory({
  userId,
  searchParams = {},
}: {
  userId: string
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const pageSize = 5
  const totalRequests = await prisma.request.count({ where: { userId } })
  const totalPages = Math.max(1, Math.ceil(totalRequests / pageSize))
  const requestedPage = Number(searchParams.requestsPage)
  const currentPage = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, totalPages)
    : 1
  const offset = (currentPage - 1) * pageSize

  const requests = await prisma.request.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: offset,
    take: pageSize
  })

  const pageHref = (page: number) => {
    const params = new URLSearchParams()
    Object.entries(searchParams).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach(item => params.append(key, item))
      else if (value !== undefined) params.set(key, value)
    })
    params.set('requestsPage', String(page))
    return `/?${params.toString()}`
  }

  return (
    <Card className="mt-0 border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <CardHeader className="bg-white border-b border-slate-100 py-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            Mis solicitudes
          </CardTitle>
          {requests.length > 0 && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              {offset + 1}–{offset + requests.length} de {totalRequests}
            </span>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 bg-white">
        {/* Vista Desktop - Tabla */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 pl-5 h-10">Tipo</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 h-10">Periodo / Fecha</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500 h-10">Estado</TableHead>
                <TableHead className="text-right font-semibold text-xs uppercase tracking-wider text-slate-500 pr-5 h-10">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                        <FileText className="h-6 w-6 text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-medium text-sm">Sin historial reciente</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id} className="group hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0">
                    <TableCell className="pl-5 py-3">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(req.type)}
                        <span className="font-medium text-sm text-slate-700">{getTypeLabel(req.type)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-700">
                          {formatUTC(req.startDate, "dd MMM")}
                          {req.returnDate && req.type === 'VACATION' && (
                            <span className="text-slate-500 font-normal"> - {formatUTC(req.returnDate, "dd MMM")}</span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          Solicitado: {formatMXDate(req.createdAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      {getStatusBadge(req.status)}
                    </TableCell>
                    <TableCell className="text-right pr-5 py-3">
                      <Link href={`/dashboard/requests/${req.id}`} className="inline-flex">
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#73C056] transition-colors" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Vista Mobile - Cards Compactas */}
        <div className="md:hidden">
          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-8 text-slate-400">
               <FileText className="h-8 w-8 mb-2 opacity-50" />
               <p className="text-sm">No hay solicitudes</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {requests.map((req) => (
                <Link href={`/dashboard/requests/${req.id}`} key={req.id} className="block hover:bg-slate-50 transition-colors">
                    <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {getTypeIcon(req.type)}
                            <div>
                                <p className="text-sm font-semibold text-slate-800">{getTypeLabel(req.type)}</p>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    {formatUTC(req.startDate, "dd MMM")}
                                    {req.returnDate && req.type === 'VACATION' && ` - ${formatUTC(req.returnDate, "dd MMM")}`}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                    Reg: {formatMXDate(req.createdAt)}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(req.status)}
                        </div>
                    </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      {totalPages > 1 && (
        <nav aria-label="Paginación de mis solicitudes" className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-3">
          {currentPage > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(currentPage - 1)} scroll={false}>Anterior</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>Anterior</Button>
          )}
          <span className="text-xs text-slate-500" aria-live="polite">
            Página {currentPage} de {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(currentPage + 1)} scroll={false}>Siguiente</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>Siguiente</Button>
          )}
        </nav>
      )}
    </Card>
  )
}
