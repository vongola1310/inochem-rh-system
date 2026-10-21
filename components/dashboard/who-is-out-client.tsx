'use client'

import { useState } from 'react'
import { CalendarDays, CheckCircle2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

type Person = {
  id: string
  name: string
  jobTitle: string
  initial: string
  startDate: string
  returnDate: string | null
  daysRequested: number
}

export function WhoIsOutTabs({ currentOut, upcomingOut }: { currentOut: Person[]; upcomingOut: Person[] }) {
  return <section aria-labelledby="absences-title" className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="px-5 pb-3 pt-5">
      <h2 id="absences-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CalendarDays className="h-4 w-4 text-[#527346]" />¿Quién está de vacaciones?</h2>
      <p className="mt-1.5 text-xs text-slate-500">Organiza tus fechas con anticipación.</p>
    </div>
    <Tabs defaultValue="today" className="gap-0">
      <div className="px-5">
        <TabsList aria-label="Vacaciones de colaboradores" className="grid h-auto w-full grid-cols-2 bg-slate-100 p-1">
          <TabsTrigger value="today" className="gap-1.5 px-2 py-2 text-xs data-[state=active]:text-[#3e712c]">Hoy <span className="font-semibold">{currentOut.length}</span></TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-1.5 px-2 py-2 text-xs data-[state=active]:text-[#3e712c]">Próximas <span className="font-semibold">{upcomingOut.length}</span></TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="today"><PeopleList people={currentOut} upcoming={false} /></TabsContent>
      <TabsContent value="upcoming"><PeopleList people={upcomingOut} upcoming /></TabsContent>
    </Tabs>
  </section>
}

function PeopleList({ people, upcoming }: { people: Person[]; upcoming: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const visiblePeople = expanded ? people : people.slice(0, 3)
  if (people.length === 0) return <div className="px-5 py-8 text-center">
    <CheckCircle2 className="mx-auto mb-3 h-6 w-6 text-[#527346]" />
    <p className="text-sm font-medium text-slate-700">{upcoming ? 'Sin vacaciones próximas' : 'Sin ausencias hoy'}</p>
    <p className="mt-1 text-xs leading-relaxed text-slate-500">{upcoming ? 'No hay vacaciones registradas para los próximos 15 días.' : 'No hay colaboradores de vacaciones hoy.'}</p>
  </div>

  return <div>
    <ul className="divide-y divide-slate-100 px-5 py-1">
      {visiblePeople.map(person => <li key={person.id} className="flex items-start gap-2.5 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#edf4e9] text-xs font-semibold text-[#3e712c]">{person.initial}</span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium leading-snug text-slate-800">{person.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{person.jobTitle}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{upcoming ? `Inicia: ${person.startDate}` : `Desde: ${person.startDate}`}<br />Regresa: {person.returnDate || 'Sin fecha registrada'}</p>
          <p className="mt-1 text-xs text-slate-500">{person.daysRequested} {person.daysRequested === 1 ? 'día solicitado' : 'días solicitados'}</p>
        </div>
      </li>)}
    </ul>
    {people.length > 3 && <div className="border-t border-slate-100 px-5 py-2"><Button type="button" variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="w-full text-xs font-semibold text-[#3e712c]">{expanded ? 'Ver menos' : `Ver ${people.length - 3} más`}</Button></div>}
  </div>
}
