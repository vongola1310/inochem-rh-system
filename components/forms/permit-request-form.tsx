'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, setYear, isWeekend } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon, Clock, FileText, Send, Cake, Lock, AlertTriangle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createRequest } from '@/app/actions/create-request'
import { toast } from "sonner" 

type Holiday = {
  date: string 
  name: string
}

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
  
  // Estados de validación
  const [dateMessage, setDateMessage] = useState<string | null>(null)
  const [isBlocked, setIsBlocked] = useState(false) // Nuevo estado para bloquear el envío

  // 1. Calcular días deshabilitados (Visual para el calendario manual)
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

  // 2. Lógica Automática de Cumpleaños (POLÍTICA ESTRICTA CON BLOQUEO)
  useEffect(() => {
    if (type === 'PERMIT_BIRTHDAY') {
        setObservation("Día libre por Cumpleaños 🎉")
        setDateMessage(null)
        setIsBlocked(false) // Reiniciamos el bloqueo
        
        if (userBirthDate) {
            const today = new Date();
            const birthDateObj = new Date(userBirthDate);
            
            // Calculamos cumpleaños exacto de este año
            const targetDate = setYear(birthDateObj, today.getFullYear());
            
            // Verificamos si es inhábil (Fines de semana o Festivos)
            const isHolidayDate = (d: Date) => {
                const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                return holidays.some(h => h.date.startsWith(dStr));
            }

            if (isWeekend(targetDate) || isHolidayDate(targetDate)) {
                // ACTIVAMOS EL BLOQUEO
                setDateMessage("Tu cumpleaños cae en día inhábil (Fin de semana o Festivo). Por política de la empresa, el día libre no es transferible.");
                setIsBlocked(true);
            }

            setDate(targetDate);
        } else {
            toast.info("No tenemos tu fecha de nacimiento registrada", {
                description: "Por favor contacta a RH."
            })
        }

    } else if (observation === "Día libre por Cumpleaños 🎉") {
        // Si cambia de tipo a otro permiso, limpiamos todo
        setObservation("")
        setDate(undefined) 
        setDateMessage(null)
        setIsBlocked(false)
    }
  }, [type, userBirthDate, holidays])

  async function handleSubmit(formData: FormData) {
    if (isBlocked) return; // Doble seguridad

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
      setDateMessage(null)
      setIsBlocked(false)
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
                disabled={isDateDisabled}
                />
            </PopoverContent>
          )}
        </Popover>
        
        {isBirthdayMode && !dateMessage && (
            <p className="text-xs text-pink-600 flex items-center gap-1 animate-in fade-in">
                <Cake className="h-3 w-3" /> ¡Feliz cumpleaños! La fecha se asigna automáticamente.
            </p>
        )}
        
        {/* AVISO DE POLÍTICA ESTRICTA (BLOQUEO) */}
        {isBirthdayMode && dateMessage && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 p-3 rounded-md text-xs border border-red-200 animate-in slide-in-from-top-1">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
                <p className="font-medium">{dateMessage}</p>
            </div>
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

      {/* BOTÓN DESHABILITADO SI ESTÁ BLOQUEADO */}
      <Button 
        type="submit" 
        className="w-full bg-[#73C056] hover:bg-[#62a847] text-white font-semibold py-6 shadow-md disabled:opacity-50 disabled:cursor-not-allowed" 
        // Agregamos la condición isBlocked
        disabled={loading || !date || isBlocked}
      >
        {loading ? (
          <>
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {isBlocked ? "No Aplica (Día Inhábil)" : "Enviar Solicitud"}
          </>
        )}
      </Button>
    </form>
  )
}