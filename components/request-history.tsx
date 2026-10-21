import { prisma } from '@/lib/prisma' // Usamos el Singleton para evitar errores de conexión
import { formatUTC, formatMXDate } from '@/lib/format-date'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle, XCircle, FileText, Calendar, ChevronRight, Ban, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Función auxiliar para traducir estados y colores (Diseño Mejorado)
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'PENDING_BOSS':
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-medium px-2 py-0.5 whitespace-nowrap">
          <Clock className="w-3 h-3 mr-1.5"/> Revisión del jefe
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
        <Badge className="bg-[#edf4e9] text-[#3e712c] border border-[#dce8d7] font-medium shadow-none hover:bg-[#edf4e9] px-2 py-0.5 whitespace-nowrap">
          <CheckCircle className="w-3 h-3 mr-1.5"/> Aprobada
        </Badge>
      )
    case 'REJECTED':
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-medium px-2 py-0.5 whitespace-nowrap">
          <XCircle className="w-3 h-3 mr-1.5"/> Rechazada
        </Badge>
      )
    case 'CANCELLED':
      return (
        <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-medium px-2 py-0.5 whitespace-nowrap">
          <Ban className="w-3 h-3 mr-1.5"/> Cancelada
        </Badge>
      )
    case 'CANCELLATION_REQUESTED':
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 font-medium px-2 py-0.5 whitespace-nowrap">
            <RefreshCw className="w-3 h-3 mr-1.5"/> Cancelación en revisión
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
  if (type === 'VACATION') return <div className="p-2 bg-[#edf4e9] rounded-lg text-[#3e712c]"><Calendar className="w-4 h-4"/></div>
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
    return `/?${params.toString()}#my-requests`
  }

  return (
    <Card className="mt-0 min-w-0 gap-0 rounded-xl border-slate-200 bg-white py-0 shadow-sm">
      <CardHeader className="block border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              Gestionar mis solicitudes
            </h2>
            <p className="mt-1 text-xs text-slate-500">Tus vacaciones y permisos, del más reciente al más antiguo.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{totalRequests}</span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-6 py-12">
            <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">Aún no tienes solicitudes</p>
            <p className="text-sm text-slate-500 mt-1">Cuando envíes una, podrás gestionarla aquí.</p>
            <Button asChild variant="outline" size="sm" className="mt-5 border-[#dce8d7] text-[#3e712c]"><Link href="/?view=new">Crear mi primera solicitud</Link></Button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requests.map((req) => (
              <li key={req.id}>
                <Link
                  href={`/dashboard/requests/${req.id}`}
                  className="group flex items-center gap-3 px-5 py-4 sm:px-6 hover:bg-[#f9fbf7] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3e712c]"
                >
                  <div className="hidden shrink-0 sm:block">{getTypeIcon(req.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <p className="text-sm font-semibold text-slate-800">{getTypeLabel(req.type)}</p>
                      {getStatusBadge(req.status)}
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600">
                      {formatUTC(req.startDate, 'dd MMM yyyy')}
                      {req.returnDate && req.type === 'VACATION' && <span className="text-slate-500"> · Regreso: {formatUTC(req.returnDate, 'dd MMM yyyy')}</span>}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {req.type === 'VACATION' && `${req.daysRequested} ${req.daysRequested === 1 ? 'día' : 'días'} · `}Enviada el {formatMXDate(req.createdAt)}
                    </p>
                  </div>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#3e712c]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {totalRequests > 0 && (
        <div className="border-t border-slate-100 px-5 py-4 sm:px-6">
          <p className="text-xs text-slate-500">
            Mostrando {offset + 1}–{offset + requests.length} de {totalRequests} solicitudes
          </p>
          {totalPages > 1 && (
            <nav aria-label="Paginación de solicitudes" className="mt-3 flex flex-wrap items-center justify-between gap-2">
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
        </div>
      )}
    </Card>
  )
}
