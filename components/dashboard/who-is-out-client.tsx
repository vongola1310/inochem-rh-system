'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Palmtree, CheckCircle2, Calendar } from 'lucide-react'

type CurrentPerson = {
  id: string
  name: string
  jobTitle: string
  initial: string
  startDate: string
  returnDate: string | null
  daysRequested: number
}

type UpcomingPerson = {
  id: string
  name: string
  jobTitle: string
  initial: string
  startDate: string
  returnDate: string | null
  daysRequested: number
}

interface WhoIsOutTabsProps {
  currentOut: CurrentPerson[]
  upcomingOut: UpcomingPerson[]
}

export function WhoIsOutTabs({ currentOut, upcomingOut }: WhoIsOutTabsProps) {
  const [tab, setTab] = useState<'today' | 'upcoming'>('today')
  const totalOut = currentOut.length + upcomingOut.length

  return (
    <Card className="border-l-4 border-l-[#73C056] shadow-sm overflow-hidden h-full flex flex-col">
      
      {/* Header */}
      <CardHeader className="pb-0 pt-5 px-5 space-y-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-8 w-8 rounded-lg bg-[#73C056]/10 flex items-center justify-center">
                <Palmtree className="h-4 w-4 text-[#73C056]" />
              </div>
              <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">
                ¿Quién está de vacaciones?
              </h3>
            </div>
          </div>

          {totalOut > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center -space-x-2">
                {currentOut.slice(0, 3).map((person) => (
                  <div
                    key={person.id}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white bg-[#73C056]/15 text-[#3d6b28]"
                  >
                    {person.initial}
                  </div>
                ))}
              </div>
              {totalOut > 3 && (
                <span className="text-[10px] font-bold text-[#73C056] bg-[#73C056]/10 px-1.5 py-0.5 rounded-md">
                  +{totalOut - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-5 pt-3 border-b border-slate-100">
          <button
            onClick={() => setTab('today')}
            className={cn(
              'pb-2 text-[13px] font-medium transition-colors relative',
              tab === 'today'
                ? 'text-slate-900 font-bold'
                : 'text-slate-400 hover:text-slate-600'
            )}
          >
            De vacaciones
            <span
              className={cn(
                'ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors',
                tab === 'today'
                  ? 'bg-[#73C056] text-white'
                  : 'bg-slate-100 text-slate-400'
              )}
            >
              {currentOut.length}
            </span>
            {tab === 'today' && (
              <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[#73C056] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setTab('upcoming')}
            className={cn(
              'pb-2 text-[13px] font-medium transition-colors relative',
              tab === 'upcoming'
                ? 'text-slate-900 font-bold'
                : 'text-slate-400 hover:text-slate-600'
            )}
          >
            Próximamente
            <span
              className={cn(
                'ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors',
                tab === 'upcoming'
                  ? 'bg-[#73C056] text-white'
                  : 'bg-slate-100 text-slate-400'
              )}
            >
              {upcomingOut.length}
            </span>
            {tab === 'upcoming' && (
              <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-[#73C056] rounded-full" />
            )}
          </button>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="p-0 flex-1 flex flex-col">
        <div className="overflow-y-auto max-h-[340px] py-1">

          {/* TAB: DE VACACIONES */}
          {tab === 'today' && (
            currentOut.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-6 w-6 text-[#73C056]/40" />}
                title="Equipo completo"
                subtitle="Nadie está de vacaciones hoy"
              />
            ) : (
              currentOut.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-[#73C056]/5 transition-colors"
                >
                  <div className="relative shrink-0">
                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold bg-[#73C056]/10 text-[#3d6b28] ring-1 ring-[#73C056]/20">
                      {person.initial}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#73C056] border-2 border-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">
                      {person.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {person.jobTitle}
                    </p>
                    <div className="flex flex-col gap-0.5 mt-1">
                      <p className="text-[10px] text-slate-500">
                        <span className="text-slate-400">Inicio:</span> <span className="font-medium">{person.startDate}</span>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        <span className="text-slate-400">Regreso:</span> <span className="font-medium">{person.returnDate || '—'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#73C056]/10 text-[#3d6b28]">
                      {person.daysRequested} {person.daysRequested === 1 ? 'día' : 'días'}
                    </span>
                  </div>
                </div>
              ))
            )
          )}

          {/* TAB: PRÓXIMAMENTE */}
          {tab === 'upcoming' && (
            upcomingOut.length === 0 ? (
              <EmptyState
                icon={<Calendar className="h-6 w-6 text-[#73C056]/40" />}
                title="Sin vacaciones próximas"
                subtitle="Nadie tiene vacaciones programadas"
              />
            ) : (
              upcomingOut.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-[#73C056]/5 transition-colors"
                >
                  <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold bg-slate-100 text-slate-500 ring-1 ring-slate-200">
                    {person.initial}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">
                      {person.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {person.jobTitle}
                    </p>
                    <div className="flex flex-col gap-0.5 mt-1">
                      <p className="text-[10px] text-slate-500">
                        <span className="text-slate-400">Inicio:</span> <span className="font-medium">{person.startDate}</span>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        <span className="text-slate-400">Regreso:</span> <span className="font-medium">{person.returnDate || '—'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      {person.daysRequested} {person.daysRequested === 1 ? 'día' : 'días'}
                    </span>
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-slate-100 px-5 py-2.5 text-center">
          <span className="text-[11px] text-slate-400 font-medium">
            {currentOut.length} de vacaciones hoy · {upcomingOut.length} próximamente
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-5">
      <div className="h-12 w-12 rounded-full bg-[#73C056]/10 flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
    </div>
  )
}