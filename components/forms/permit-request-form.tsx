'use client'

import { useState, useEffect } from 'react'
import { format, setYear, isPast, addYears } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon, Clock, FileText, Send, Cake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createRequest } from '@/app/actions/create-request'
import { toast } from "sonner" 

// 1. ACEPTAMOS LA NUEVA PROP 'userBirthDate'
export function PermitRequestForm({ userId, userBirthDate }: { userId: string, userBirthDate?: Date | null }) {
  const [date, setDate] = useState<Date>()
  const [type, setType] = useState<string>("PERMIT_LATE")
  const [observation, setObservation] = useState("") 
  const [loading, setLoading] = useState(false)

  // 2. EFECTO MÁGICO: AUTOCOMPLETAR FECHA Y MOTIVO
  useEffect(() => {
    if (type === 'PERMIT_BIRTHDAY') {
        setObservation("Día libre por Cumpleaños 🎉")
        
        // Si tenemos la fecha de nacimiento registrada, calculamos la de este año
        if (userBirthDate) {
            const today = new Date();
            const birthDateObj = new Date(userBirthDate);
            
            // Ponemos el cumpleaños en el año actual
            let nextBirthday = setYear(birthDateObj, today.getFullYear());
            
            // Si el cumpleaños ya pasó este año (ej: cumple en Enero y estamos en Marzo),
            // opcionalmente podrías sugerir el del próximo año, pero por ahora dejamos el actual
            // para registro o el próximo si prefieres:
            /* if (isPast(nextBirthday) && nextBirthday.getDate() !== today.getDate()) {
               nextBirthday = addYears(nextBirthday, 1); 
            } 
            */

            // Ajuste zona horaria local para el calendario
            setDate(nextBirthday);
        } else {
            toast.info("No tenemos tu fecha de nacimiento registrada", {
                description: "Por favor selecciona la fecha manualmente."
            })
        }

    } else if (observation === "Día libre por Cumpleaños 🎉") {
        setObservation("")
        // Opcional: Limpiar fecha si cambia de opción
        // setDate(undefined) 
    }
  }, [type, userBirthDate]) // Se ejecuta cuando cambia el tipo o carga la fecha

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    
    if (date) formData.set('startDate', date.toISOString())
    formData.set('userId', userId)
    // Aseguramos que el motivo se envíe (por si el usuario lo editó o es el automático)
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

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Header del Formulario */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="h-10 w-10 rounded-lg bg-[#73C056]/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-[#73C056]" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-slate-900">Solicitud de Permiso</h3>
          <p className="text-sm text-slate-500">Formato FO02</p>
        </div>
      </div>
      
      {/* Tipo de Permiso */}
      <div className="space-y-2">
        <Label className="text-slate-700 font-medium">Tipo de Incidencia</Label>
        <Select name="type" onValueChange={setType} value={type}>
          <SelectTrigger className="border-slate-300 focus:border-[#73C056] focus:ring-[#73C056] transition-colors">
            <SelectValue placeholder="Selecciona..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PERMIT_LATE">
              <span className="flex items-center gap-2">
                <span>⏰</span> Llegar Tarde
              </span>
            </SelectItem>
            <SelectItem value="PERMIT_EARLY">
              <span className="flex items-center gap-2">
                <span>🏃</span> Salir Temprano
              </span>
            </SelectItem>
            <SelectItem value="PERMIT_ABSENCE">
              <span className="flex items-center gap-2">
                <span>📅</span> Faltar (Día completo)
              </span>
            </SelectItem>
            
            {/* OPCIÓN DE CUMPLEAÑOS */}
            <SelectItem value="PERMIT_BIRTHDAY">
              <span className="flex items-center gap-2 font-medium text-pink-600">
                <Cake className="h-4 w-4" /> Día de Cumpleaños
              </span>
            </SelectItem>

            <SelectItem value="PERMIT_OTHER">
              <span className="flex items-center gap-2">
                <span>📝</span> Otro
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Fecha */}
      <div className="flex flex-col space-y-2">
        <Label className="text-slate-700 font-medium">Fecha del Permiso</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className={`w-full justify-start text-left font-normal border-slate-300 hover:border-[#73C056] hover:bg-[#73C056]/5 transition-colors ${!date && "text-muted-foreground"}`}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-[#73C056]" />
              {date ? format(date, "PPP", { locale: es }) : <span>Selecciona la fecha</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar 
              mode="single" 
              selected={date} 
              onSelect={setDate} 
              initialFocus
              locale={es}
              className="rounded-md border"
            />
          </PopoverContent>
        </Popover>
        {date && (
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <CalendarIcon className="h-3 w-3" />
            Fecha seleccionada: {format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        )}
      </div>

      {/* Hora (Solo si aplica) - Se oculta si es cumpleaños */}
      {(type === 'PERMIT_LATE' || type === 'PERMIT_EARLY') && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <Label className="text-slate-700 font-medium">
            Horario {type === 'PERMIT_LATE' ? '(Hora de llegada)' : '(Hora de salida)'}
          </Label>
          <div className="relative">
            <Clock className="absolute left-3 top-3 h-4 w-4 text-[#73C056]" />
            <Input 
              name="permitTime" 
              placeholder="Ej: 10:30 AM" 
              className="pl-10 border-slate-300 focus:border-[#73C056] focus:ring-[#73C056] transition-colors" 
            />
          </div>
          <p className="text-xs text-slate-500">Formato: HH:MM AM/PM</p>
        </div>
      )}

      {/* Motivo */}
      <div className="flex flex-col space-y-2">
        <Label htmlFor="obs" className="text-slate-700 font-medium">
          Motivo <span className="text-red-500">*</span>
        </Label>
        <Textarea 
          name="observations" 
          id="obs" 
          placeholder="Ej: Cita médica, Trámite personal, Asunto familiar..." 
          required 
          rows={4}
          // VINCULAMOS EL TEXTAREA AL ESTADO
          value={observation}
          onChange={(e) => setObservation(e.target.value)}
          className="border-slate-300 focus:border-[#73C056] focus:ring-[#73C056] transition-colors resize-none"
        />
        <p className="text-xs text-slate-500">Por favor, proporciona una justificación clara y detallada</p>
      </div>

      <Button 
        type="submit" 
        className="w-full bg-[#73C056] hover:bg-[#62a847] text-white font-semibold py-6 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" 
        disabled={loading || !date}
      >
        {loading ? (
          <>
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Solicitar Permiso
          </>
        )}
      </Button>

      {!date && (
        <p className="text-xs text-amber-600 text-center bg-amber-50 p-2 rounded-md">
          ⚠️ Selecciona una fecha para continuar
        </p>
      )}
    </form>
  )
}