'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setBackupBoss } from '@/app/actions/set-backup'
import { toast } from "sonner"
import { UserCog, ChevronDown, ShieldCheck } from 'lucide-react'
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
    <details className="group min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-xl p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e712c] [&::-webkit-details-marker]:hidden">
        <UserCog className="h-4 w-4 shrink-0 text-[#527346]" />
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">Delegar aprobaciones</span><span className={`mt-1 block text-xs ${isActive ? 'text-amber-700' : 'text-slate-500'}`}>{isActive ? 'Respaldo configurado' : 'Configura un jefe interino'}</span></span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-100 p-5">
        <p className="mb-4 text-xs leading-relaxed text-slate-500">Elige quién aprobará las solicitudes de tu equipo durante tu ausencia.</p>
        <form action={handleSubmit} className="space-y-4">
            
            <div className="space-y-1">
                <Label htmlFor="backup-boss" className="text-xs font-semibold text-slate-600">Jefe de respaldo</Label>
                <Select name="backupId" defaultValue={currentBackupId || "none"}>
                    <SelectTrigger id="backup-boss" className="h-10 w-full min-w-0 text-sm bg-white [&>span]:truncate">
                        <SelectValue placeholder="Selecciona un encargado..." />
                    </SelectTrigger>
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

            <div className="grid gap-3">
                <div className="space-y-1">
                    <Label htmlFor="backup-start" className="text-xs font-semibold text-slate-600">Desde</Label>
                    <Input id="backup-start" type="date" name="startDate" defaultValue={defaultStart} className="h-10 min-w-0 text-sm bg-white" required={!currentBackupId} />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="backup-end" className="text-xs font-semibold text-slate-600">Hasta</Label>
                    <Input id="backup-end" type="date" name="endDate" defaultValue={defaultEnd} className="h-10 min-w-0 text-sm bg-white" required={!currentBackupId}/>
                </div>
            </div>

            <Button type="submit" size="sm" className="h-10 w-full bg-[#3e712c] hover:bg-[#315a23]" disabled={loading}>
                {loading ? 'Guardando...' : isActive ? 'Actualizar Delegación' : 'Activar Respaldo'}
            </Button>

            {isActive && (
                <div className="flex items-start gap-2 p-2 bg-orange-100 rounded-md text-xs text-orange-800 border border-orange-200 mt-2">
                    <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5"/>
                    <p>Actualmente las solicitudes de tu equipo se redirigen al respaldo seleccionado.</p>
                </div>
            )}
        </form>
      </div>
    </details>
  )
}
