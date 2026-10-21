import { CalendarDays } from 'lucide-react'
import { formatUTC } from '@/lib/format-date'

type BalanceProps = {
  totalDays: number
  usedDays: number
  pendingDays: number
  pendingHRDays: number
  cycleStart: Date
  cycleEnd: Date
  nextTotalDays: number
  nextRequestedDays: number
  nextCycleStart: Date
  nextCycleEnd: Date
}

export function VacationBalanceSummary({ totalDays, usedDays, pendingDays, pendingHRDays, cycleStart, cycleEnd, nextTotalDays, nextRequestedDays, nextCycleStart, nextCycleEnd }: BalanceProps) {
  const available = totalDays - usedDays - pendingDays
  const nextAvailable = nextTotalDays - nextRequestedDays
  return <section aria-label="Saldo de vacaciones" className="grid overflow-hidden rounded-xl border border-[#dfe6dc] bg-white shadow-sm md:grid-cols-[1.35fr_1fr]">
    <div className="p-5 sm:px-6">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600"><CalendarDays className="h-4 w-4 text-[#527346]" /><h2>Periodo actual</h2></div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <p className="flex items-baseline gap-2"><strong className={`text-4xl font-semibold tracking-tight ${available < 0 ? 'text-red-700' : 'text-[#3e712c]'}`}>{available}</strong><span className="text-sm text-slate-600">días disponibles</span></p>
        <dl className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
          <div><dt className="text-xs text-slate-500">Asignados</dt><dd className="mt-1 font-semibold tabular-nums">{totalDays}</dd></div>
          <div><dt className="text-xs text-slate-500">Aprobados por jefe</dt><dd className="mt-1 font-semibold tabular-nums">{usedDays}</dd></div>
          <div><dt className="text-xs text-slate-500">Pendientes de jefe</dt><dd className={`mt-1 font-semibold tabular-nums ${pendingDays > 0 ? 'text-amber-700' : ''}`}>{pendingDays}</dd></div>
        </dl>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{pendingHRDays > 0 ? <><span className="font-medium text-blue-700">{pendingHRDays} {pendingHRDays === 1 ? 'día en revisión de RH' : 'días en revisión de RH'}</span>, ya {pendingHRDays === 1 ? 'incluido' : 'incluidos'} en los aprobados por jefe.</> : 'Sin días pendientes de revisión de RH.'}</p>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">Vigencia: {formatUTC(cycleStart, 'd MMM yyyy')} — {formatUTC(cycleEnd, 'd MMM yyyy')}</p>
    </div>
    <div className="border-t border-[#dfe6dc] bg-[#f9fbf7] p-5 sm:px-6 md:border-l md:border-t-0">
      <h2 className="text-sm font-medium text-slate-600">Próximo periodo</h2>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1"><strong className={`text-3xl font-semibold tracking-tight ${nextAvailable < 0 ? 'text-red-700' : 'text-slate-700'}`}>{nextAvailable}</strong><span className="text-sm text-slate-600">días disponibles de {nextTotalDays}</span></div>
      <p className="mt-1 text-xs text-slate-500">{nextRequestedDays} {nextRequestedDays === 1 ? 'día ya solicitado' : 'días ya solicitados'}</p>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">Vigencia: {formatUTC(nextCycleStart, 'd MMM yyyy')} — {formatUTC(nextCycleEnd, 'd MMM yyyy')}</p>
    </div>
  </section>
}
