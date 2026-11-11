'use client'

import { useState } from 'react'
import { CalendarDays, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type AbsentPerson = { id: string; name: string; jobTitle: string; initial: string; startDate: string; endDate: string; category: 'VACATION' | 'ABSENCE'; labels: string[] }

export function WhoIsOutTabs({ currentOut, upcomingOut }: { currentOut: AbsentPerson[]; upcomingOut: AbsentPerson[] }) {
  const [filter, setFilter] = useState<'all' | 'vacation'>('all')
  const select = (people: AbsentPerson[]) => filter === 'vacation' ? people.filter(person => person.category === 'VACATION') : people
  return <section aria-labelledby="absences-title" className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="px-5 pb-3 pt-5"><h2 id="absences-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CalendarDays className="h-4 w-4 text-[#527346]" />¿Quién está ausente?</h2><p className="mt-1.5 text-xs leading-relaxed text-slate-500">Vacaciones, permisos y otras ausencias autorizadas o confirmadas.</p></div>
    <div className="mx-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Filtrar ausencias">
      <button type="button" onClick={() => setFilter('all')} aria-pressed={filter === 'all'} className={`min-h-9 rounded-md px-2 text-xs font-semibold ${filter === 'all' ? 'bg-white text-[#3e712c] shadow-sm' : 'text-slate-500'}`}>Ausentes</button>
      <button type="button" onClick={() => setFilter('vacation')} aria-pressed={filter === 'vacation'} className={`min-h-9 rounded-md px-2 text-xs font-semibold ${filter === 'vacation' ? 'bg-white text-[#3e712c] shadow-sm' : 'text-slate-500'}`}>Vacaciones</button>
    </div>
    <p className="px-5 pb-1 pt-5 text-xs font-semibold text-slate-500">Hoy · {select(currentOut).length}</p><PeopleList key={`today-${filter}`} people={select(currentOut)} upcoming={false} />
    <p className="border-t border-slate-100 px-5 pb-1 pt-4 text-xs font-semibold text-slate-500">Próximos 15 días · {select(upcomingOut).length}</p><PeopleList key={`upcoming-${filter}`} people={select(upcomingOut)} upcoming />
  </section>
}

function PeopleList({ people, upcoming }: { people: AbsentPerson[]; upcoming: boolean }) {
  const [expanded, setExpanded] = useState(false)
  if (!people.length) return <div className="flex items-center gap-2 px-5 py-5 text-xs leading-relaxed text-slate-500"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#527346]" />{upcoming ? 'Sin ausencias próximas con este filtro.' : 'Sin ausencias registradas hoy con este filtro.'}</div>
  return <div><ul className="divide-y divide-slate-100 px-5">{(expanded ? people : people.slice(0, 3)).map(person => <li key={person.id} className="flex items-start gap-2.5 py-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#edf4e9] text-xs font-semibold text-[#3e712c]">{person.initial}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium leading-snug">{person.name}</p><p className="mt-0.5 text-xs text-slate-500">{person.jobTitle}</p><p className="mt-2 text-xs font-medium text-[#3e712c]">{person.labels.join(' · ')}</p><p className="mt-1 text-xs text-slate-500">{person.startDate === person.endDate ? person.startDate : `${person.startDate} al ${person.endDate}`}</p></div></li>)}</ul>{people.length > 3 && <div className="border-t border-slate-100 px-5 py-2"><Button type="button" variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="w-full text-xs font-semibold text-[#3e712c]">{expanded ? 'Ver menos' : `Ver ${people.length - 3} más`}</Button></div>}</div>
}
