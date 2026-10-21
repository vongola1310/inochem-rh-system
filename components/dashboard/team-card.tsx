'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, User, CalendarDays, AlertTriangle, ArrowRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from 'next/link'
import { formatUTC } from '@/lib/format-date'
import type { TeamMemberVacation } from '@/lib/team-vacations'

// Días antes del aniversario en que se avisa que el saldo está por vencer
const EXPIRY_WARNING_DAYS = 45

export function TeamCard({ members }: { members: TeamMemberVacation[] }) {
  const count = members.length

  return (
    <Dialog>
      <Card className="min-w-0 gap-0 border-slate-200 bg-white py-0 shadow-sm transition-colors hover:border-[#b8cfae] group relative">
        {/* El Trigger cubre toda la tarjeta para que sea clicable */}
        <DialogTrigger asChild>
            <button type="button" aria-label="Ver los saldos de vacaciones de mi equipo" className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e712c]" />
        </DialogTrigger>
        
        <CardHeader className="block px-5 pb-0 pt-5">
          <div className="flex items-center justify-between">
            <CardTitle><h2 className="text-sm font-semibold text-slate-900">Mi equipo</h2></CardTitle>
            <div className="h-7 w-7 rounded-lg bg-[#edf4e9] flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-[#3e712c]" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-2">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-semibold text-slate-900">{count}</span>
            <span className="text-xs text-slate-500">{count === 1 ? 'persona a tu cargo' : 'personas a tu cargo'}</span>
          </div>

          {/* Vista previa de Avatares (Solo los primeros 5) */}
          {count > 0 ? (
             <div className="flex -space-x-2 overflow-hidden mb-2 pl-1">
                {members.slice(0, 5).map((m) => (
                    <Avatar key={m.id} className="inline-block h-8 w-8 ring-2 ring-white">
                        <AvatarFallback className="bg-slate-200 text-slate-600 text-[10px] font-bold">
                            {m.name.charAt(0)}
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
          
          <p className="mt-3 text-xs text-[#3e712c] font-semibold flex items-center gap-1">
             Ver saldos del equipo <ArrowRight className="h-3.5 w-3.5" />
          </p>
        </CardContent>
      </Card>

      {/* MODAL CON EL DESGLOSE DE DÍAS POR COLABORADOR */}
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Users className="h-5 w-5 text-[#73C056]"/>
            Vacaciones de mi equipo
          </DialogTitle>
          <DialogDescription className="text-xs">
            Días que le tocan a cada colaborador en su periodo vigente y en el siguiente.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[65vh] w-full pr-4 mt-1">
            <div className="space-y-3">
                {members.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                        No tienes subordinados registrados.
                    </div>
                ) : (
                    members.map((m) => <MemberRow key={m.id} member={m} />)
                )}
            </div>
        </ScrollArea>

        {count > 0 && (
          <div className="border-t border-slate-100 pt-3 flex justify-end">
            <Link
              href="/team/history"
              className="text-xs font-semibold text-[#73C056] hover:text-[#5fa843] flex items-center gap-1 transition-colors"
            >
              Ver tabla completa e historial del equipo <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MemberRow({ member: m }: { member: TeamMemberVacation }) {
  const base = Math.max(m.totalDays, m.usedDays + m.pendingDays, 1)
  const usedPct = (m.usedDays / base) * 100
  const pendingPct = (m.pendingDays / base) * 100
  const expiringSoon = m.availableDays > 0 && m.daysToAnniversary <= EXPIRY_WARNING_DAYS

  return (
    <div className="p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50/60 transition-colors">
      {/* Encabezado: persona + disponibles */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-10 w-10 border border-slate-200 shrink-0">
            <AvatarFallback className="bg-[#73C056]/10 text-[#73C056] font-bold">
              {m.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{m.name}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
              <User className="h-3 w-3 shrink-0"/>
              {m.jobTitle || "Sin puesto"}
              <span className="text-slate-300">·</span>
              {m.yearsWorked} {m.yearsWorked === 1 ? 'año' : 'años'}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className={`flex items-center justify-end gap-1 text-xl font-bold leading-none ${m.availableDays < 0 ? 'text-red-500' : 'text-[#73C056]'}`}>
            <CalendarDays className="h-4 w-4" />
            <span>{m.availableDays}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">de {m.totalDays} disponibles</p>
        </div>
      </div>

      {/* Barra de consumo */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-[#73C056]/15 overflow-hidden flex">
        <div className="h-full bg-slate-400" style={{ width: `${usedPct}%` }} />
        <div className="h-full bg-amber-400" style={{ width: `${pendingPct}%` }} />
      </div>

      {/* Desglose */}
      <div className="mt-2.5 grid grid-cols-4 gap-2 text-center">
        <Stat label="Le tocan" value={m.totalDays} className="text-slate-800" />
        <Stat label="Aprobados por jefe" value={m.usedDays} className="text-slate-500" dot="bg-slate-400" />
        <Stat label="Pendientes de jefe" value={m.pendingDays} className="text-amber-600" dot="bg-amber-400" />
        <Stat label="Disponibles" value={m.availableDays} className={m.availableDays < 0 ? 'text-red-500' : 'text-[#73C056]'} dot="bg-[#73C056]/40" />
      </div>

      <p className="mt-2 text-xs text-slate-500">{m.pendingHRDays > 0 ? `${m.pendingHRDays} días en revisión de RH, incluidos en los aprobados por jefe.` : 'Sin días pendientes de revisión de RH.'}</p>
      {/* Vigencia y próximo periodo */}
      <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px]">
        <span className="text-slate-500">
          Vigencia: <span className="font-medium text-slate-700">{formatUTC(m.cycleStart, "d MMM yy")} — {formatUTC(m.cycleEnd, "d MMM yy")}</span>
        </span>
        <span className="text-slate-500">
          Próximo periodo: <span className="font-semibold text-slate-700">{m.nextPeriodDays} días</span>
          {m.nextPeriodRequested > 0 && (
            <span className="text-amber-600"> ({m.nextPeriodRequested} ya pedidos)</span>
          )}
        </span>
      </div>

      {expiringSoon && (
        <div className="mt-2 flex items-center gap-1.5 rounded-md bg-orange-50 border border-orange-100 px-2 py-1 text-[11px] text-orange-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {m.daysToAnniversary === 0
            ? <>Hoy cumple aniversario: sus {m.availableDays} días disponibles vencen.</>
            : <>Le quedan {m.availableDays} días que vencen en {m.daysToAnniversary} {m.daysToAnniversary === 1 ? 'día' : 'días'} ({formatUTC(m.cycleEnd, "d MMM")}).</>}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, className, dot }: { label: string; value: number; className?: string; dot?: string }) {
  return (
    <div className="rounded-md bg-slate-50 py-1.5">
      <p className={`text-sm font-bold leading-none ${className ?? ''}`}>{value}</p>
      <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-center gap-1">
        {dot && <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />}
        {label}
      </p>
    </div>
  )
}
