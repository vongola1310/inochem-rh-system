'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIconLucide, Palmtree, Send, Info, CalendarCheck, Cake } from 'lucide-react'
import { Button } from '@/components/ui/button'
// Asegúrate de que este import coincida con tu archivo calendar.tsx (exportación nombrada)
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
  holidays = [],
  userBirthDate // Recibimos la fecha de cumpleaños
}: { 
  userId: string
  holidays?: Holiday[]
  userBirthDate?: Date | null
}) {
  const [startDate, setStartDate] = useState<Date>()
  const [returnDate, setReturnDate] = useState<Date>()
  const [loading, setLoading] = useState(false)
  const [businessDays, setBusinessDays] = useState(0)
  const [breakdown, setBreakdown] = useState({
    total: 0,
    weekends: 0,
    holidays: 0,
    business: 0,
    birthday: 0
  })

  // Memoizar keys para evitar recálculos innecesarios
  const holidaysKey = useMemo(
    () => holidays.map(h => h.date).sort().join(','),
    [holidays]
  )

  useEffect(() => {
    // Crear set de festivos para búsqueda rápida
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
      setBreakdown({ total: 0, weekends: 0, holidays: 0, business: 0, birthday: 0 })
    }
  }, [startDate, returnDate, holidaysKey, holidays, userBirthDate])

  function calculateBusinessDays(start: Date, end: Date, holidays: Set<string>) {
    const result = { total: 0, weekends: 0, holidays: 0, business: 0, birthday: 0 }
    
    // Normalizar horas a medianoche
    const startDay = new Date(start); startDay.setHours(0, 0, 0, 0)
    const endDay = new Date(end); endDay.setHours(0, 0, 0, 0)

    const current = new Date(startDay)
    
    // Iterar desde el inicio hasta el día anterior al regreso
    while (current < endDay) {
      result.total++
      const dayOfWeek = current.getDay()
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`

      // LÓGICA DE CUMPLEAÑOS (Mes y Día)
      let isBirthday = false;
      if (userBirthDate) {
        const bdate = new Date(userBirthDate);
        // Usamos UTC para la fecha guardada y local para la fecha actual del bucle
        // Asegurando coincidencia MM-DD
        const birthMMDD = `${String(bdate.getUTCMonth() + 1).padStart(2, '0')}-${String(bdate.getUTCDate()).padStart(2, '0')}`;
        const currentMMDD = `${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        
        if (birthMMDD === currentMMDD) {
            isBirthday = true;
        }
      }

      // Clasificación de días
      if (dayOfWeek === 0 || dayOfWeek === 6) {
         result.weekends++
      } else if (holidays.has(dateStr)) {
         result.holidays++
      } else if (isBirthday) {
         result.birthday++ // Día regalado
      } else {
         result.business++ // Día cobrado
      }

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
    
    // Enviamos el cálculo del cliente como referencia, pero el servidor recalcula por seguridad
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

  // Función para deshabilitar fechas en el calendario (Fines de semana y Festivos)
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
          Solo se contabilizan <strong>días hábiles</strong>. Los fines de semana, días festivos y tu cumpleaños no se descuentan de tu saldo.
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

      {/* Resumen y Desglose */}
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
            {breakdown.birthday > 0 && (
                <p className="text-xs text-[#73C056] mt-1 flex items-center gap-1 font-bold">
                    <Cake className="w-3 h-3"/> ¡Incluye tu cumpleaños de regalo! (No se descuenta)
                </p>
            )}
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Desglose del periodo</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="text-[10px] text-slate-500 mb-1">Total</p>
                <p className="text-lg font-bold text-slate-900">{breakdown.total}</p>
              </div>
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="text-[10px] text-slate-500 mb-1">Finde</p>
                <p className="text-lg font-bold text-slate-600">{breakdown.weekends}</p>
              </div>
              <div className="bg-white rounded p-2 border border-slate-200">
                <p className="text-[10px] text-slate-500 mb-1">Festivos</p>
                <p className="text-lg font-bold text-slate-600">{breakdown.holidays}</p>
              </div>
              <div className={`rounded p-2 border ${breakdown.birthday > 0 ? 'bg-pink-50 border-pink-200' : 'bg-white border-slate-200'}`}>
                <p className={`text-[10px] mb-1 ${breakdown.birthday > 0 ? 'text-pink-600 font-bold' : 'text-slate-500'}`}>Cumple</p>
                <p className={`text-lg font-bold ${breakdown.birthday > 0 ? 'text-pink-600' : 'text-slate-600'}`}>{breakdown.birthday}</p>
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
          placeholder="Ej: Viaje familiar programado, Asuntos personales..." 
          rows={4}
          className="border-slate-300 focus:border-[#73C056] focus:ring-[#73C056] transition-colors resize-none"
        />
      </div>

      <Button 
        type="submit" 
        className="w-full bg-[#73C056] hover:bg-[#62a847] text-white font-semibold py-6 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" 
        disabled={loading || !startDate || !returnDate || (businessDays === 0 && breakdown.birthday === 0)}
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