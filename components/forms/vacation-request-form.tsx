'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
// RENOMBRAMOS EL ÍCONO PARA EVITAR CONFLICTOS
import { Calendar as CalendarIconLucide, Palmtree, Send, Info, CalendarCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
// IMPORTACIÓN CORRECTA DEL COMPONENTE (NOMBRADA)
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  holidays = [] 
}: { 
  userId: string
  holidays?: Holiday[]
}) {
  const [startDate, setStartDate] = useState<Date>()
  const [returnDate, setReturnDate] = useState<Date>()
  const [loading, setLoading] = useState(false)
  const [businessDays, setBusinessDays] = useState(0)
  const [breakdown, setBreakdown] = useState({
    total: 0,
    weekends: 0,
    holidays: 0,
    business: 0
  })

  const holidaysKey = useMemo(
    () => holidays.map(h => h.date).sort().join(','),
    [holidays]
  )

  useEffect(() => {
    const holidayDates = new Set(
      holidays.map(h => {
        const date = new Date(h.date)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      })
    )
    
    if (startDate && returnDate) {
      const days = calculateBusinessDays(startDate, returnDate, holidayDates)
      setBusinessDays(days.business)
      setBreakdown(days)
    } else {
      setBusinessDays(0)
      setBreakdown({ total: 0, weekends: 0, holidays: 0, business: 0 })
    }
  }, [startDate, returnDate, holidaysKey, holidays])

  function calculateBusinessDays(start: Date, end: Date, holidays: Set<string>) {
    const result = { total: 0, weekends: 0, holidays: 0, business: 0 }
    const startDay = new Date(start); startDay.setHours(0, 0, 0, 0)
    const endDay = new Date(end); endDay.setHours(0, 0, 0, 0)

    if (startDay.getTime() === endDay.getTime()) {
      result.total = 1
      const dayOfWeek = startDay.getDay()
      const dateStr = `${startDay.getFullYear()}-${String(startDay.getMonth() + 1).padStart(2, '0')}-${String(startDay.getDate()).padStart(2, '0')}`
      
      if (dayOfWeek === 0 || dayOfWeek === 6) result.weekends = 1
      else if (holidays.has(dateStr)) result.holidays = 1
      else result.business = 1
      return result
    }

    const current = new Date(startDay)
    while (current < endDay) {
      result.total++
      const dayOfWeek = current.getDay()
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`

      if (dayOfWeek === 0 || dayOfWeek === 6) result.weekends++
      else if (holidays.has(dateStr)) result.holidays++
      else result.business++

      current.setDate(current.getDate() + 1)
    }
    return result
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    if (startDate) formData.set('startDate', startDate.toISOString())
    if (returnDate) formData.set('returnDate', returnDate.toISOString())
    formData.set('userId', userId)
    formData.set('type', 'VACATION')
    formData.set('daysRequested', businessDays.toString())

    const result = await createRequest(null, formData)
    setLoading(false)
    
    if (result.success) {
      toast.success("Solicitud Enviada", { description: result.message })
      setStartDate(undefined)
      setReturnDate(undefined)
    } else {
      toast.error("Error", { description: result.message })
    }
  }

  const isDateDisabled = useMemo(() => {
    const holidayDates = new Set(
      holidays.map(h => {
        const date = new Date(h.date)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      })
    )
    
    return (date: Date) => {
      const dayOfWeek = date.getDay()
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      return dayOfWeek === 0 || dayOfWeek === 6 || holidayDates.has(dateStr)
    }
  }, [holidays])

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
          Solo se contabilizan <strong>días hábiles</strong>. Los fines de semana y días festivos no se descuentan de tu periodo vacacional.
        </p>
      </div>
      
      {/* Fecha Inicio */}
      <div className="flex flex-col space-y-2">
        <Label className="text-slate-700 font-medium">Fecha de Inicio de Vacaciones</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className={`w-full justify-start text-left font-normal border-slate-300 hover:border-[#73C056] hover:bg-[#73C056]/5 transition-colors ${!startDate && "text-muted-foreground"}`}
            >
              <CalendarIconLucide className="mr-2 h-4 w-4 text-[#73C056]" />
              {startDate ? format(startDate, "PPP", { locale: es }) : <span>¿Cuándo inician tus vacaciones?</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar 
              mode="single" 
              selected={startDate} 
              onSelect={setStartDate} 
              initialFocus
              locale={es}
              className="rounded-md border"
              disabled={isDateDisabled}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Fecha Regreso */}
      <div className="flex flex-col space-y-2">
        <Label className="text-slate-700 font-medium">Fecha de Regreso a Labores</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className={`w-full justify-start text-left font-normal border-slate-300 hover:border-[#73C056] hover:bg-[#73C056]/5 transition-colors ${!returnDate && "text-muted-foreground"}`}
            >
              <CalendarCheck className="mr-2 h-4 w-4 text-[#73C056]" />
              {returnDate ? format(returnDate, "PPP", { locale: es }) : <span>¿Cuándo reanudas labores?</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar 
              mode="single" 
              selected={returnDate} 
              onSelect={setReturnDate} 
              initialFocus
              locale={es}
              className="rounded-md border"
              disabled={(date) => {
                if (startDate && date <= startDate) return true
                return isDateDisabled(date)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {businessDays > 0 && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-4 bg-[#73C056]/10 rounded-lg border-2 border-[#73C056]/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIconLucide className="h-5 w-5 text-[#73C056]" />
                <span className="text-sm font-semibold text-slate-900">Días hábiles a descontar:</span>
              </div>
              <span className="text-3xl font-bold text-[#73C056]">{businessDays}</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Desglose del periodo</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Total días</p>
                <p className="text-lg font-bold text-slate-900">{breakdown.total}</p>
              </div>
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Fines semana</p>
                <p className="text-lg font-bold text-slate-600">{breakdown.weekends}</p>
              </div>
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Festivos</p>
                <p className="text-lg font-bold text-slate-600">{breakdown.holidays}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col space-y-2">
        <Label htmlFor="obs" className="text-slate-700 font-medium">
          Observaciones <span className="text-slate-400">(Opcional)</span>
        </Label>
        <Textarea 
          name="observations" 
          id="obs" 
          placeholder="Ej: Viaje familiar programado..." 
          rows={4}
          className="border-slate-300 focus:border-[#73C056] focus:ring-[#73C056] resize-none"
        />
      </div>

      <Button 
        type="submit" 
        className="w-full bg-[#73C056] hover:bg-[#62a847] text-white font-semibold py-6 shadow-md" 
        disabled={loading || !startDate || !returnDate || businessDays === 0}
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
    </form>
  )
}