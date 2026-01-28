'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, User, CalendarDays } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"

// Definición del tipo de datos que espera el componente
type Subordinate = {
  id: string
  name: string
  jobTitle: string | null
  email: string
  image?: string | null
  // Incluimos el balance para calcular días disponibles
  balance?: {
    totalDays: number
    usedDays: number
    pendingDays: number
  } | null
}

export function TeamCard({ subordinates }: { subordinates: Subordinate[] }) {
  const count = subordinates.length

  return (
    <Dialog>
      <Card className="border-l-4 border-l-[#73C056] hover:shadow-lg transition-all hover:-translate-y-1 sm:col-span-2 lg:col-span-1 h-full cursor-pointer group relative">
        {/* El Trigger cubre toda la tarjeta para que sea clicable */}
        <DialogTrigger asChild>
            <div className="absolute inset-0 z-10" />
        </DialogTrigger>
        
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">Mi Equipo</CardTitle>
            <div className="h-10 w-10 rounded-full bg-[#73C056]/10 flex items-center justify-center shrink-0 group-hover:bg-[#73C056] transition-colors">
              <Users className="h-5 w-5 text-[#73C056] group-hover:text-white transition-colors" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl sm:text-4xl font-bold text-slate-900">{count}</span>
            <span className="text-sm text-slate-600 font-medium">personas</span>
          </div>

          {/* Vista previa de Avatares (Solo los primeros 5) */}
          {count > 0 ? (
             <div className="flex -space-x-2 overflow-hidden mb-2 pl-1">
                {subordinates.slice(0, 5).map((sub) => (
                    <Avatar key={sub.id} className="inline-block h-8 w-8 ring-2 ring-white">
                        <AvatarImage src={sub.image || ""} />
                        <AvatarFallback className="bg-slate-200 text-slate-600 text-[10px] font-bold">
                            {sub.name.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                ))}
                {count > 5 && (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-white bg-slate-100 text-[10px] font-medium text-slate-500">
                        +{count - 5}
                    </div>
                )}
             </div>
          ) : (
             <p className="text-xs text-slate-400 italic mb-2">No tienes personal a cargo</p>
          )}
          
          <p className="text-xs text-slate-500 font-medium flex items-center gap-1 group-hover:text-[#73C056] transition-colors">
             {count > 0 ? 'Clic para ver detalles y saldos' : 'A tu cargo'}
          </p>
        </CardContent>
      </Card>

      {/* MODAL CON LA LISTA DETALLADA */}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Users className="h-5 w-5 text-[#73C056]"/>
            Mi Equipo de Trabajo
          </DialogTitle>
        </DialogHeader>
        
        {/* Usamos ScrollArea para listas largas */}
        <ScrollArea className="h-[60vh] w-full pr-4 mt-2">
            <div className="space-y-3">
                {subordinates.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        No tienes subordinados registrados.
                    </div>
                ) : (
                    subordinates.map((sub) => {
                        // Cálculo de días disponibles individuales
                        const total = sub.balance?.totalDays || 0
                        const used = sub.balance?.usedDays || 0
                        const pending = sub.balance?.pendingDays || 0
                        const available = total - used - pending
                        
                        return (
                            <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 border border-slate-200">
                                        <AvatarImage src={sub.image || ""} />
                                        <AvatarFallback className="bg-[#73C056]/10 text-[#73C056] font-bold">
                                            {sub.name.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{sub.name}</p>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            <User className="h-3 w-3"/>
                                            {sub.jobTitle || "Sin puesto"}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* MOSTRAR SALDO DISPONIBLE EN VERDE */}
                                <div className="text-right">
                                    <div className={`flex items-center justify-end gap-1 font-bold ${available < 0 ? 'text-red-500' : 'text-[#73C056]'}`}>
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        <span>{available}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400">días disp.</p>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}