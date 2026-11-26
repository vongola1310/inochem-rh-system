'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { RefreshCw, Radio } from 'lucide-react'
import { getDirectRemoteAttendance } from '@/app/actions/remote-clock'
import { displayDate, displayTime, displayWeekday } from '@/lib/attendance/dates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function DirectRemoteAttendance({ team, today }: { team: boolean; today: string }) {
  const [date, setDate] = useState(today), [query, setQuery] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const { data, error, isValidating, mutate } = useSWR(['direct-remote-attendance', team, date, search, page], () => getDirectRemoteAttendance({ team, date, search, page }), {
    refreshInterval: 15000, refreshWhenHidden: false, revalidateOnFocus: true, shouldRetryOnError: false,
  })
  return <section aria-label="Asistencia remota directa" className="space-y-4 rounded-2xl border border-teal-200 bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold text-teal-950"><Radio className="h-5 w-5 shrink-0" />{team ? 'Asistencia remota de mi equipo' : 'Mis checadas remotas'}</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Checadas directas del colaborador, sin esperar la carga de un periodo de RH. Actualización automática cada 15 segundos mientras esta pantalla está visible.</p></div><Button type="button" variant="outline" disabled={isValidating} onClick={() => void mutate()} className="min-h-11 gap-2"><RefreshCw className={'h-4 w-4 ' + (isValidating ? 'animate-spin' : '')} />Actualizar</Button></div>
    <form onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setPage(1) }} className="flex flex-wrap items-end gap-3">
      <div className="flex w-full items-end gap-2 sm:w-auto"><label className="w-full min-w-0 space-y-1 text-sm sm:w-auto sm:min-w-48 sm:flex-1"><span className="block">Fecha de checadas</span><Input type="date" value={date} max={data?.today || today} min="1900-01-01" required onChange={event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) { setDate(event.target.value); setPage(1) } }} className="min-h-11 w-full min-w-0" /></label>
      <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={() => { setDate(data?.today || today); setPage(1) }}>Hoy</Button></div>
      {team && <><label className="w-full min-w-0 space-y-1 text-sm sm:w-auto sm:min-w-48 sm:flex-1"><span className="block">Colaborador</span><Input value={query} onChange={event => setQuery(event.target.value)} maxLength={100} placeholder="Nombre o número de empleado" className="min-h-11" /></label><Button type="submit" className="min-h-11 w-full bg-teal-800 sm:w-auto text-white hover:bg-teal-900">Buscar</Button></>}
    </form>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">No se pudo actualizar la asistencia. Verifica la fecha o vuelve a intentar. Los registros mostrados pueden estar desactualizados.</p>}
    {!data && !error && <p role="status" className="text-sm text-slate-500">Consultando checadas…</p>}
    {data && <><div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>{displayWeekday(data.date)} {displayDate(data.date)} · {data.count} {data.count === 1 ? 'colaborador' : 'colaboradores'}</span><span>Hora de Ciudad de México</span></div>
      {!data.people.length && <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-600">{team ? 'No hay colaboradores remotos a tu cargo con estos filtros.' : 'No tienes checadas remotas para esta fecha ni el checador habilitado.'}</p>}
      <div className="grid gap-4 xl:grid-cols-2">{data.people.map(person => {
        const entry = person.remotePunches.find(p => p.kind === 'ENTRY'), exit = person.remotePunches.find(p => p.kind === 'EXIT')
        const label = entry && exit ? 'Entrada y salida registradas' : entry ? data.date === data.today ? 'Jornada en curso' : 'Sin registro de salida' : exit ? 'Sin registro de entrada' : 'Sin checadas'
        const tone = entry && exit ? 'bg-green-100 text-green-900' : entry && data.date === data.today ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-700'
        return <article key={person.id} className="min-w-0 rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-semibold">{person.name}</h3><p className="mt-1 text-xs text-slate-500">Empleado #{person.employeeNumber}</p></div><span className={'rounded-md px-2 py-1 text-xs font-medium ' + tone}>{label}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-3">{[['Entrada', entry], ['Salida', exit]].map(([name, value]) => {
            const punch = value as typeof entry
            return <div key={String(name)} className="min-w-0 rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{String(name)}</p><p className="mt-1 font-semibold">{punch ? displayTime(punch.seconds) : 'Sin registro'}</p>{punch && <a className="mt-2 inline-block min-h-8 text-sm font-medium text-teal-800 underline" href={`/api/remote-clock/${encodeURIComponent(punch.id)}/photo`} target="_blank" rel="noreferrer">Ver foto</a>}</div>
          })}</div>
        </article>
      })}</div>
      {data.pages > 1 && <div className="flex flex-wrap items-center justify-end gap-3 text-sm"><Button type="button" variant="outline" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>Anterior</Button><span>Página {data.page} de {data.pages}</span><Button type="button" variant="outline" disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)}>Siguiente</Button></div>}
    </>}
    <p className="border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">Esta vista muestra los registros originales. “Sin checadas” no equivale por sí solo a una falta: el dictamen considera vacaciones, permisos, incapacidades y la jornada aplicable. Los filtros de periodos de abajo no afectan esta consulta.</p>
  </section>
}
