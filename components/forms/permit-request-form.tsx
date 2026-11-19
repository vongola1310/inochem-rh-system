'use client'

import { useState, useMemo } from 'react'
import { Clock, FileText, Send, Cake, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RequestDatePicker } from './request-date-picker'
import { calendarDate, calendarKey, birthdayPermission, validateRequestDates } from '@/lib/request-dates'
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
    holidays = [],
    onSuccess,
}: { 
    userId: string, 
    userBirthDate?: Date | null,
    holidays?: Holiday[]
    onSuccess?: () => void
}) {
  const [date, setDate] = useState<Date>()
  const [type, setType] = useState<string>("PERMIT_LATE")
  const [observation, setObservation] = useState("") 
  const [loading, setLoading] = useState(false)
  
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date.slice(0, 10))), [holidays])
  const birthday = birthdayPermission(userBirthDate, holidaySet)
  const isBirthdayMode = type === 'PERMIT_BIRTHDAY'
  const selectedDate = isBirthdayMode ? (birthday.key ? calendarDate(birthday.key) : undefined) : date
  const dateMessage = isBirthdayMode ? birthday.error : null
  const validationError = selectedDate ? validateRequestDates(type, calendarKey(selectedDate), calendarKey(selectedDate), holidaySet, userBirthDate) : null
  const isBlocked = Boolean(dateMessage || validationError)
  function changeType(next: string) {
    if (next === 'PERMIT_BIRTHDAY') setObservation('Día libre por Cumpleaños 🎉')
    else if (isBirthdayMode) setObservation('')
    setType(next)
  }

  async function handleSubmit(formData: FormData) {
    if (loading || isBlocked || !selectedDate) return

    setLoading(true)
    try {
    
      formData.set('startDate', calendarKey(selectedDate))
      formData.set('type', type)
      formData.set('userId', userId)
      formData.set('observations', observation)

      const result = await createRequest(null, formData)
    
      if (result.success) {
        toast.success("Permiso Enviado", { description: result.message })
        setDate(undefined)
        setType("PERMIT_LATE")
        setObservation("")
        onSuccess?.()
      } else {
        toast.error("Error", { description: result.message })
      }
    } catch { toast.error("No se pudo enviar. Intenta nuevamente; conservamos tus datos.") }
    finally { setLoading(false) }
  }

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
        <Label className="text-slate-700 font-medium">Tipo de permiso</Label>
        <Select name="type" onValueChange={changeType} disabled={loading} value={type}>
          <SelectTrigger className="border-slate-300 focus:border-[#73C056] focus:ring-[#73C056] transition-colors">
            <SelectValue placeholder="Selecciona..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PERMIT_LATE"><span>⏰</span> Llegar Tarde</SelectItem>
            <SelectItem value="PERMIT_EARLY"><span>🏃</span> Salir Temprano</SelectItem>
            <SelectItem value="PERMIT_ABSENCE"><span>📅</span> Faltar (Día completo)</SelectItem>
            <SelectItem value="PERMIT_HOME_OFFICE"><span>🏠</span> Home Office</SelectItem>
            <SelectItem value="PERMIT_BIRTHDAY"><span className="text-pink-600 font-medium"><Cake className="h-4 w-4 inline mr-1"/> Día de Cumpleaños</span></SelectItem>
            <SelectItem value="PERMIT_OTHER"><span>📝</span> Otro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col space-y-2">
        <RequestDatePicker label="Fecha del permiso" value={selectedDate} onChange={setDate} holidays={holidays} disabled={loading || isBirthdayMode} hint={isBirthdayMode ? 'Se utiliza tu fecha de nacimiento registrada.' : 'Selecciona el día hábil en que necesitas el permiso.'} />
        {!isBirthdayMode && validationError && <p role="alert" className="text-sm text-red-700">{validationError}</p>}

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
            <Input name="permitTime" type="time" required className="pl-10 border-slate-300 focus:border-[#73C056]" />
          </div>
        </div>
      )}

      <div className="flex flex-col space-y-2">
        <Label htmlFor="permit-observations" className="text-slate-700 font-medium">Motivo</Label>
        <Textarea 
          name="observations" 
          id="permit-observations"
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
        className="h-11 w-full bg-[#3e712c] hover:bg-[#315a23] text-white font-semibold shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
        // Agregamos la condición isBlocked
        disabled={loading || !selectedDate || isBlocked}
      >
        {loading ? (
          <>
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {isBlocked ? "Revisa la fecha del permiso" : "Enviar Solicitud"}
          </>
        )}
      </Button>
    </form>
  )
}
