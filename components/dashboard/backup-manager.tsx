'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { setBackupBoss } from '@/app/actions/set-backup'
import { toast } from "sonner"
import { UserCog, CalendarClock, ShieldCheck } from 'lucide-react'
import { format } from 'date-fns'

type SimpleUser = { id: string; name: string; jobTitle: string | null }

export function BackupManager({ 
    employees, 
    currentBackupId,
    currentStart,
    currentEnd
}: { 
    employees: SimpleUser[], 
    currentBackupId?: string | null,
    currentStart?: Date | null,
    currentEnd?: Date | null
}) {
  const [loading, setLoading] = useState(false)
  
  // Convertir fechas a string YYYY-MM-DD para los inputs
  const defaultStart = currentStart ? format(currentStart, 'yyyy-MM-dd') : ''
  const defaultEnd = currentEnd ? format(currentEnd, 'yyyy-MM-dd') : ''

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    const res = await setBackupBoss(formData)
    setLoading(false)
    
    if (res.success) {
      toast.success("Configuración Actualizada", { description: res.message })
    } else {
      toast.error("Error", { description: res.message })
    }
  }

  const isActive = currentBackupId && new Date() <= (currentEnd || new Date())

  return (
    <Card className={`border-l-4 ${isActive ? 'border-orange-500 bg-orange-50/30' : 'border-slate-300'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
            <UserCog className={`h-5 w-5 ${isActive ? 'text-orange-600' : 'text-slate-500'}`} />
            <CardTitle className="text-base font-bold text-slate-800">Delegar Aprobaciones (Jefe Interino)</CardTitle>
        </div>
        <CardDescription className="text-xs">
            Si saldrás de vacaciones, elige quién aprobará las solicitudes de tu equipo en tu ausencia.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
            
            <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Jefe de Respaldo</Label>
                <Select name="backupId" defaultValue={currentBackupId || "none"}>
                    <SelectTrigger className="h-9 text-sm bg-white">
                        <SelectValue placeholder="Selecciona un encargado..." />
                    </SelectTrigger>
                    {/* AQUÍ ESTÁ LA MAGIA: max-h-[250px] y overflow-y-auto */}
                    <SelectContent className="max-h-[250px] overflow-y-auto">
                        <SelectItem value="none" className="text-slate-500 italic">-- Nadie (Yo apruebo) --</SelectItem>
                        {employees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id} className="cursor-pointer">
                                {emp.name} <span className="text-xs text-slate-400 ml-1">({emp.jobTitle})</span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-600">Desde</Label>
                    <div className="relative">
                        <CalendarClock className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400"/>
                        <Input type="date" name="startDate" defaultValue={defaultStart} className="h-9 pl-7 text-xs bg-white" required={!currentBackupId} />
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-600">Hasta</Label>
                    <div className="relative">
                        <CalendarClock className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400"/>
                        <Input type="date" name="endDate" defaultValue={defaultEnd} className="h-9 pl-7 text-xs bg-white" required={!currentBackupId}/>
                    </div>
                </div>
            </div>

            <Button type="submit" size="sm" className={`w-full ${isActive ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-900'}`} disabled={loading}>
                {loading ? 'Guardando...' : isActive ? 'Actualizar Delegación' : 'Activar Respaldo'}
            </Button>

            {isActive && (
                <div className="flex items-start gap-2 p-2 bg-orange-100 rounded-md text-xs text-orange-800 border border-orange-200 mt-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5"/>
                    <p>Actualmente las solicitudes de tu equipo se redirigen al respaldo seleccionado.</p>
                </div>
            )}
        </form>
      </CardContent>
    </Card>
  )
}