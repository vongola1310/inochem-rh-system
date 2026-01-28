'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, setYear } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon, Clock, FileText, Send, Cake, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createRequest } from '@/app/actions/create-request'
import { toast } from "sonner" 

// Definimos el tipo para los festivos
type Holiday = {
  date: string 
  name: string
}

// CORRECCIÓN: Agregamos 'holidays' a las props del componente y al tipo
export function PermitRequestForm({ 
    userId, 
    userBirthDate,
    holidays = []
}: { 
    userId: string, 
    userBirthDate?: Date | null,
    holidays?: Holiday[]
}) {
  const [date, setDate] = useState<Date>()
  const [type, setType] = useState<string>("PERMIT_LATE")
  const [observation, setObservation] = useState("") 
  const [loading, setLoading] = useState(false)

  // 1. Calcular días deshabilitados (Fines de semana y Festivos)
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
      // Deshabilitamos Sábado(6), Domingo(0) y Festivos
      return dayOfWeek === 0 || dayOfWeek === 6 || holidayDates.has(dateStr)
    }
  }, [holidays])

  useEffect(() => {
    if (type === 'PERMIT_BIRTHDAY') {
        setObservation("Día libre por Cumpleaños 🎉")
        
        if (userBirthDate) {
            const today = new Date();
            const birthDateObj = new Date(userBirthDate);
            let nextBirthday = setYear(birthDateObj, today.getFullYear());
            setDate(nextBirthday);
        } else {
            toast.info("No tenemos tu fecha de nacimiento registrada", {
                description: "Por favor contacta a RH o selecciona la fecha manualmente."
            })
        }

    } else if (observation === "Día libre por Cumpleaños 🎉") {
        setObservation("")
        setDate(undefined) 
    }
  }, [type, userBirthDate])

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    
    if (date) formData.set('startDate', date.toISOString())
    formData.set('userId', userId)
    formData.set('observations', observation)

    const result = await createRequest(null, formData)
    setLoading(false)
    
    if (result.success) {
      toast.success("Permiso Enviado", { description: result.message })
      setDate(undefined)
      setType("PERMIT_LATE")
      setObservation("")
    } else {
      toast.error("Error", { description: result.message })
    }
  }

  const isBirthdayMode = type === 'PERMIT_BIRTHDAY';

  return (
    <form action={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="h-10 w-10 rounded-lg bg-[#73C056]/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-[#73C056]" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-slate-900">Solicitud de Permiso</h3>
          <p className="text-sm text-slate-500">Formato FO02</p>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label className="text-slate-700 font-medium">Tipo de Incidencia</Label>
        <Select name="type" onValueChange={setType} value={type}>
          <SelectTrigger className="border-slate-300 focus:border-[#73C056] focus:ring-[#73C056] transition-colors">
            <SelectValue placeholder="Selecciona..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PERMIT_LATE"><span>⏰</span> Llegar Tarde</SelectItem>
            <SelectItem value="PERMIT_EARLY"><span>🏃</span> Salir Temprano</SelectItem>
            <SelectItem value="PERMIT_ABSENCE"><span>📅</span> Faltar (Día completo)</SelectItem>
            <SelectItem value="PERMIT_BIRTHDAY"><span className="text-pink-600 font-medium"><Cake className="h-4 w-4 inline mr-1"/> Día de Cumpleaños</span></SelectItem>
            <SelectItem value="PERMIT_OTHER"><span>📝</span> Otro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col space-y-2">
        <Label className="text-slate-700 font-medium">Fecha del Permiso</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              disabled={isBirthdayMode}
              className={`w-full justify-start text-left font-normal border-slate-300 ${!date && "text-muted-foreground"} ${isBirthdayMode ? "bg-slate-100 opacity-100 cursor-not-allowed" : "hover:border-[#73C056]"}`}
            >
              {isBirthdayMode ? <Lock className="mr-2 h-4 w-4 text-slate-400" /> : <CalendarIcon className="mr-2 h-4 w-4 text-[#73C056]" />}
              {date ? format(date, "PPP", { locale: es }) : <span>Selecciona la fecha</span>}
            </Button>
          </PopoverTrigger>
          {!isBirthdayMode && (
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar 
                mode="single" 
                selected={date} 
                onSelect={setDate} 
                initialFocus
                locale={es}
                className="rounded-md border"
                // 2. APLICAMOS EL BLOQUEO DE FECHAS AQUÍ
                disabled={isDateDisabled}
                />
            </PopoverContent>
          )}
        </Popover>
        {isBirthdayMode && (
            <p className="text-xs text-pink-600 flex items-center gap-1 animate-in fade-in">
                <Cake className="h-3 w-3" /> ¡Feliz cumpleaños! La fecha se asigna automáticamente.
            </p>
        )}
      </div>

      {(type === 'PERMIT_LATE' || type === 'PERMIT_EARLY') && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <Label className="text-slate-700 font-medium">Horario</Label>
          <div className="relative">
            <Clock className="absolute left-3 top-3 h-4 w-4 text-[#73C056]" />
            <Input name="permitTime" placeholder="Ej: 10:30 AM" className="pl-10 border-slate-300 focus:border-[#73C056]" />
          </div>
        </div>
      )}

      <div className="flex flex-col space-y-2">
        <Label htmlFor="obs" className="text-slate-700 font-medium">Motivo</Label>
        <Textarea 
          name="observations" 
          id="obs" 
          placeholder="Ej: Cita médica..." 
          required 
          rows={4}
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          disabled={isBirthdayMode}
          className={`border-slate-300 focus:border-[#73C056] resize-none ${isBirthdayMode ? "bg-slate-50" : ""}`}
        />
      </div>

      <Button type="submit" className="w-full bg-[#73C056] hover:bg-[#62a847] text-white font-semibold py-6 shadow-md" disabled={loading || !date}>
         {loading ? 'Enviando...' : <><Send className="mr-2 h-4 w-4" /> Enviar Solicitud</>}
      </Button>
    </form>
  )
}