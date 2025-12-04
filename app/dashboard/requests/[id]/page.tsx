import { PrismaClient } from '@prisma/client'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { processRequest } from '@/app/actions/manage-request'
import { CalendarDays, Clock, AlertCircle, CheckCircle, XCircle, FileText, User, ArrowLeft } from 'lucide-react'
import { DownloadButton } from '@/components/pdf/download-button'
import Link from 'next/link'

const prisma = new PrismaClient()

const TYPE_LABELS: Record<string, string> = {
  VACATION: 'Solicitud de Vacaciones',
  PERMIT_LATE: 'Permiso para Llegar Tarde',
  PERMIT_EARLY: 'Permiso para Salir Temprano',
  PERMIT_ABSENCE: 'Permiso de Ausencia',
  PERMIT_BIRTHDAY: 'Permiso de Cumpleaños',
  PERMIT_OTHER: 'Permiso Especial',
}

// Función para calcular el desglose de días
function calculateDaysBreakdown(
  startDate: Date,
  returnDate: Date | null,
  holidays: Set<string>
) {
  if (!returnDate) {
    return { total: 0, weekends: 0, holidays: 0, business: 0 }
  }

  const result = {
    total: 0,
    weekends: 0,
    holidays: 0,
    business: 0
  }

  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(returnDate)
  end.setHours(0, 0, 0, 0)

  // Iterar desde inicio hasta el día ANTERIOR al regreso
  const current = new Date(start)
  while (current < end) {
    result.total++
    const dayOfWeek = current.getDay()
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      result.weekends++
    } else if (holidays.has(dateStr)) {
      result.holidays++
    } else {
      result.business++
    }

    current.setDate(current.getDate() + 1)
  }

  return result
}

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const { id } = params

  const request = await prisma.request.findUnique({
    where: { id },
    include: { user: { include: { balance: true } } }
  })

  if (!request) return notFound()

  // Obtener festivos para el cálculo
  const allHolidays = await prisma.holiday.findMany()
  const holidayDates = new Set(
    allHolidays.map(h => {
      const date = new Date(h.date)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    })
  )

  const isVacation = request.type === 'VACATION'
  const canDownload = request.approvedByBoss || request.approvedByHR
  const isPending = request.status === 'PENDING_BOSS' || request.status === 'PENDING_HR'

  // Calcular desglose de días si es vacación
  const breakdown = isVacation && request.returnDate
    ? calculateDaysBreakdown(request.startDate, request.returnDate, holidayDates)
    : null

  const getStatusInfo = () => {
    switch (request.status) {
      case 'APPROVED':
        return { label: 'Aprobado', color: 'text-[#73C056]', bg: 'bg-[#73C056]/5', border: 'border-[#73C056]/20', icon: CheckCircle }
      case 'REJECTED':
        return { label: 'Rechazado', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle }
      case 'PENDING_BOSS':
        return { label: 'Pendiente de Jefe', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock }
      case 'PENDING_HR':
        return { label: 'Pendiente de RH', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: Clock }
      default:
        return { label: request.status, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', icon: AlertCircle }
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        
        {/* Botón de Regreso */}
        <Link href="/">
          <Button variant="ghost" className="mb-6 -ml-2 text-slate-600 hover:text-[#73C056]">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>

        {/* Container Principal Limpio */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          
          {/* Header */}
          <div className="p-6 sm:p-8 border-b border-slate-100">
            <h1 className="text-3xl font-bold text-[#73C056] mb-3">
              {TYPE_LABELS[request.type] || 'Solicitud'}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="font-medium text-slate-900">{request.user.name}</span>
              </div>
              <span className="text-slate-300">•</span>
              <span>{format(request.createdAt, "d 'de' MMMM 'de' yyyy", { locale: es })}</span>
            </div>

            {/* Estado */}
            <div className="flex flex-wrap items-center gap-3">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusInfo.bg} border ${statusInfo.border}`}>
                <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                <span className={`text-sm font-semibold ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
              
              {canDownload && <DownloadButton data={request} />}
            </div>

            {!canDownload && (
              <div className="mt-4 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>El PDF estará disponible cuando el jefe autorice</span>
              </div>
            )}
          </div>

          {/* Contenido */}
          <div className="p-6 sm:p-8 space-y-8">
            
            {/* VACACIONES */}
            {isVacation ? (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-[#73C056]" />
                  Periodo
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {/* Inicio */}
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">Inicio</p>
                    <p className="text-2xl font-bold text-slate-900 mb-1">
                      {format(request.startDate, "d 'de' MMMM", { locale: es })}
                    </p>
                    <p className="text-sm text-slate-600 capitalize">
                      {format(request.startDate, "EEEE", { locale: es })}
                    </p>
                  </div>

                  {/* Regreso */}
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">Regreso</p>
                    <p className="text-2xl font-bold text-slate-900 mb-1">
                      {request.returnDate ? format(request.returnDate, "d 'de' MMMM", { locale: es }) : 'N/A'}
                    </p>
                    <p className="text-sm text-slate-600 capitalize">
                      {request.returnDate ? format(request.returnDate, "EEEE", { locale: es }) : ''}
                    </p>
                  </div>
                </div>

                {/* Días Hábiles Destacados */}
                <div className="bg-[#73C056]/10 rounded-xl p-6 border-2 border-[#73C056]/30 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-[#73C056]" />
                      <span className="text-sm font-semibold text-slate-900">Días hábiles descontados:</span>
                    </div>
                    <span className="text-4xl font-bold text-[#73C056]">{request.daysRequested}</span>
                  </div>
                </div>

                {/* Desglose del Periodo */}
                {breakdown && (
                  <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 space-y-3">
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Desglose del periodo</p>
                    
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-white rounded-lg p-4 border border-slate-200">
                        <p className="text-xs text-slate-500 mb-2">Total de días</p>
                        <p className="text-2xl font-bold text-slate-900">{breakdown.total}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-slate-200">
                        <p className="text-xs text-slate-500 mb-2">Fines de semana</p>
                        <p className="text-2xl font-bold text-slate-600">{breakdown.weekends}</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 border border-slate-200">
                        <p className="text-xs text-slate-500 mb-2">Días Festivos</p>
                        <p className="text-2xl font-bold text-slate-600">{breakdown.holidays}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-xs text-slate-600 bg-blue-50 p-3 rounded-lg border border-blue-200 mt-3">
                      <AlertCircle className="h-3 w-3 shrink-0 mt-0.5 text-blue-600"/>
                      <p>Los fines de semana y días festivos <strong>no se descontaron</strong> del saldo de vacaciones.</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* PERMISOS */
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#73C056]" />
                  Detalles del Permiso
                </h2>
                
                {/* Fecha */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mb-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-medium">Fecha</p>
                  <p className="text-xl font-bold text-slate-900 mb-1">
                    {format(request.startDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                  <p className="text-sm text-slate-600 capitalize">
                    {format(request.startDate, "EEEE", { locale: es })}
                  </p>
                </div>
                
                {/* Horario */}
                {request.permitTime && (
                  <div className="bg-[#73C056]/5 rounded-xl p-5 border border-[#73C056]/20 mb-4">
                    <p className="text-xs text-[#73C056] uppercase tracking-wider mb-3 font-semibold">Horario</p>
                    <div className="flex items-center gap-3">
                      <Clock className="h-8 w-8 text-[#73C056]" />
                      <span className="text-3xl font-bold text-slate-900">{request.permitTime}</span>
                    </div>
                  </div>
                )}

                {/* Nota */}
                <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#73C056]"/>
                  <p>Este permiso queda a consideración de RH para descuento de nómina.</p>
                </div>
              </div>
            )}

            {/* Observaciones */}
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#73C056]" />
                Observaciones
              </h2>
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <p className="text-slate-700 leading-relaxed">
                  {request.observations || "Sin observaciones"}
                </p>
              </div>
            </div>

            {/* Motivo de Rechazo */}
            {request.rejectionReason && (
              <div>
                <h2 className="text-lg font-semibold text-red-600 mb-3 flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Motivo de Rechazo
                </h2>
                <div className="bg-red-50 rounded-xl p-5 border border-red-200">
                  <p className="text-red-900 leading-relaxed">
                    {request.rejectionReason}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Acciones */}
          {isPending && (
            <div className="p-6 sm:p-8 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-end gap-3">
              <form action={processRequest}>
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="action" value="REJECT" />
                <Button 
                  variant="outline" 
                  className="w-full sm:w-auto border-red-300 text-red-600 hover:bg-red-50 h-11 font-medium" 
                  type="submit"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rechazar
                </Button>
              </form>

              <form action={processRequest}>
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="action" value="APPROVE" />
                <Button 
                  className="w-full sm:w-auto bg-[#73C056] hover:bg-[#62a847] h-11 font-semibold shadow-sm" 
                  type="submit"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Autorizar
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}