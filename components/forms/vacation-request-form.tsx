'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIconLucide, Palmtree, Send, Info, Cake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RequestDatePicker } from './request-date-picker'
import { calendarKey, vacationBreakdown, validateRequestDates } from '@/lib/request-dates'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createRequest } from '@/app/actions/create-request'
import { toast } from "sonner"

type Holiday = {
  date: string 
  name: string
}

export function VacationRequestForm({ 
  userId, 
  holidays = [],
  userBirthDate,
  onSuccess,
}: { 
  userId: string
  holidays?: Holiday[]
  userBirthDate?: Date | null
  onSuccess?: () => void
}) {
  const [startDate, setStartDate] = useState<Date>()
  const [returnDate, setReturnDate] = useState<Date>()
  const [loading, setLoading] = useState(false)
  const [dateNotice, setDateNotice] = useState('')
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date.slice(0, 10))), [holidays])
  const breakdown = useMemo(() => startDate && returnDate
    ? vacationBreakdown(calendarKey(startDate), calendarKey(returnDate), holidaySet, userBirthDate)
    : { total: 0, weekends: 0, holidays: 0, business: 0, birthday: 0 }, [startDate, returnDate, holidaySet, userBirthDate])
  const businessDays = breakdown.business
  const dateError = startDate && returnDate ? validateRequestDates('VACATION', calendarKey(startDate), calendarKey(returnDate), holidaySet, userBirthDate) : null
  function changeStart(date: Date | undefined) {
    setStartDate(date)
    setDateNotice('')
    if (!date || (returnDate && calendarKey(returnDate) <= calendarKey(date))) {
      setReturnDate(undefined)
      if (date && returnDate) setDateNotice('Elige un nuevo regreso posterior a la fecha de inicio.')
    }
  }

  async function handleSubmit(formData: FormData) {
    if (loading || !startDate || !returnDate || dateError) return
    setLoading(true)
    try {
      if (startDate) formData.set('startDate', calendarKey(startDate))
      if (returnDate) formData.set('returnDate', calendarKey(returnDate))
      formData.set('userId', userId)
      formData.set('type', 'VACATION')
    
      // Enviamos el cálculo del cliente como referencia, pero el servidor recalcula por seguridad
      formData.set('daysRequested', businessDays.toString())

      const result = await createRequest(null, formData)
    
      if (result.success) {
        toast.success("Solicitud Enviada", { description: result.message })
        setStartDate(undefined)
        setReturnDate(undefined)
        onSuccess?.()
      } else {
        toast.error("Error", { description: result.message })
      }
    } catch { toast.error("No se pudo enviar. Intenta nuevamente; conservamos tus fechas.") }
    finally { setLoading(false) }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="h-10 w-10 rounded-lg bg-[#73C056]/10 flex items-center justify-center">
          <Palmtree className="h-5 w-5 text-[#73C056]" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-slate-900">Solicitud de Vacaciones</h3>
          <p className="text-sm text-slate-500">Formato FO03</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          Solo se contabilizan <strong>días hábiles</strong>. Los fines de semana, días festivos y tu cumpleaños no se descuentan de tu período.
        </p>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2">
        <RequestDatePicker label="Primer día de vacaciones" value={startDate} onChange={changeStart} holidays={holidays} disabled={loading} rangeStart={startDate} rangeEnd={returnDate} hint="Selecciona el primer día que no asistirás." />
        <RequestDatePicker label="Regreso a labores" value={returnDate} onChange={date => { setReturnDate(date); setDateNotice('') }} holidays={holidays} after={startDate} disabled={loading || !startDate} rangeStart={startDate} rangeEnd={returnDate} hint="Este día vuelves a trabajar y no se descuenta." />
      </div>
      {(dateNotice || dateError) && <div aria-live="polite">
        {dateNotice && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{dateNotice}</p>}
        {dateError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{dateError}</p>}
      </div>}

      {/* Resumen y Desglose */}
      {startDate && returnDate && !dateError && (
        <div aria-live="polite" className="space-y-3">
          <p className="text-sm text-slate-600">Desde <strong>{format(startDate, 'EEEE d MMM yyyy', { locale: es })}</strong>. Regresas el <strong>{format(returnDate, 'EEEE d MMM yyyy', { locale: es })}</strong>.</p>
          <div className="p-4 bg-[#73C056]/10 rounded-lg border-2 border-[#73C056]/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIconLucide className="h-5 w-5 text-[#73C056]" />
                <span className="text-sm font-semibold text-slate-900">Días hábiles a descontar:</span>
              </div>
              <span className="text-3xl font-bold text-[#3e712c]">{businessDays}</span>
            </div>
            {breakdown.birthday > 0 && (
                <p className="text-xs text-[#3e712c] mt-1 flex items-center gap-1 font-bold">
                    <Cake className="w-3 h-3"/> ¡Incluye tu cumpleaños de regalo! (No se descuenta)
                </p>
            )}
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Desglose del periodo</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Días del periodo</p>
                <p className="text-lg font-bold text-slate-900">{breakdown.total}</p>
              </div>
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Fin de semana</p>
                <p className="text-lg font-bold text-slate-600">{breakdown.weekends}</p>
              </div>
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Festivos</p>
                <p className="text-lg font-bold text-slate-600">{breakdown.holidays}</p>
              </div>
              <div className={`rounded p-2 border ${breakdown.birthday > 0 ? 'bg-pink-50 border-pink-200' : 'bg-white border-slate-200'}`}>
                <p className={`text-xs mb-1 ${breakdown.birthday > 0 ? 'text-pink-600 font-bold' : 'text-slate-500'}`}>Cumpleaños</p>
                <p className={`text-lg font-bold ${breakdown.birthday > 0 ? 'text-pink-600' : 'text-slate-600'}`}>{breakdown.birthday}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col space-y-2">
        <Label htmlFor="vacation-observations" className="text-slate-700 font-medium">
          Observaciones <span className="text-slate-400">(Opcional)</span>
        </Label>
        <Textarea 
          name="observations" 
          id="vacation-observations"
          placeholder="Ej: Viaje familiar programado, Asuntos personales..." 
          rows={4}
          className="border-slate-300 focus:border-[#73C056] focus:ring-[#73C056] transition-colors resize-none"
        />
      </div>

      <Button 
        type="submit" 
        className="h-11 w-full bg-[#3e712c] hover:bg-[#315a23] text-white font-semibold shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={loading || !!dateError || !startDate || !returnDate || (businessDays === 0 && breakdown.birthday === 0)}
      >
        {loading ? (
          <>
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Solicitar
          </>
        )}
      </Button>

      {(!startDate || !returnDate) && (
        <p className="text-xs text-amber-600 text-center bg-amber-50 p-2 rounded-md">
          ⚠️ Selecciona ambas fechas para continuar
        </p>
      )}

      {businessDays === 0 && startDate && returnDate && breakdown.birthday === 0 && (
        <p className="text-xs text-red-600 text-center bg-red-50 p-2 rounded-md">
          ⚠️ El periodo seleccionado no contiene días hábiles
        </p>
      )}
    </form>
  )
}
