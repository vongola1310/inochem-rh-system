'use client'
import { useMemo, useState } from 'react'
import { AttendanceLeaderList } from './leader-list'
import type { AttendanceDisplayDay } from '@/lib/attendance/grouping'
import type { periodTotals } from '@/lib/attendance/engine'
import { displayDate } from '@/lib/attendance/dates'

export type ReportDay = AttendanceDisplayDay
type Props = { days: ReportDay[]; totals: (ReturnType<typeof periodTotals>[number] & { fieldDays?: number })[]; stale: boolean; period?: { start: string; end: string; businessDays: number } }
function AttendancePeriodSummary({ days, totals, period }: Props) {
  const [person, setPerson] = useState('all')
  const employees = useMemo(() => [...new Map(days.map(day => [day.userId, day.user])).entries()].sort((a, b) => a[1].name.localeCompare(b[1].name)), [days])
  const visible = totals.filter(total => person === 'all' || total.userId === person)
  const summary = visible.reduce((sum, row) => ({ late: sum.late + row.late, absences: sum.absences + row.absences, incidents: sum.incidents + row.incidents, pending: sum.pending + row.pending, justified: sum.justified + row.justified }), { late: 0, absences: 0, incidents: 0, pending: 0, justified: 0 })
  return <section className="space-y-5 p-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Resumen del periodo</h2>{period && <p className="mt-2 text-sm text-slate-500">{displayDate(period.start)} — {displayDate(period.end)} · {period.businessDays} días hábiles</p>}</div><select aria-label="Filtrar colaborador" className="h-11 max-w-full rounded-lg border bg-white px-3 text-sm" value={person} onChange={event => setPerson(event.target.value)}><option value="all">Todos los colaboradores</option>{employees.map(([id, user]) => <option key={id} value={id}>{user.name} · {user.employeeNumber}</option>)}</select></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Retardos', summary.late], ['Faltas', summary.absences], ['Otras incidencias', summary.incidents], ['Por resolver', summary.pending]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <div className="space-y-4" role="img" aria-label={'Dictámenes del periodo: ' + summary.late + ' retardos, ' + summary.absences + ' faltas, ' + summary.incidents + ' otras incidencias'}>
        {[{ label: 'Retardos', value: summary.late, color: 'bg-orange-500' }, { label: 'Faltas', value: summary.absences, color: 'bg-red-500' }, { label: 'Otras incidencias', value: summary.incidents, color: 'bg-violet-500' }, { label: 'Justificados', value: summary.justified, color: 'bg-green-600' }, { label: 'Pendientes', value: summary.pending, color: 'bg-slate-400' }].map(bar => <div key={bar.label}><div className="mb-1 flex justify-between text-xs"><span>{bar.label}</span><strong>{bar.value}</strong></div><div className="h-4 overflow-hidden rounded bg-slate-100"><div className={'h-full rounded ' + bar.color} style={{ width: bar.value / Math.max(1, ...Object.values(summary)) * 100 + '%' }} /></div></div>)}
        <p className="text-xs text-slate-500">Cada retardo conserva su clasificación. No se convierte en falta.</p>
      </div>
      <div className="max-h-96 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50"><tr>{['Colaborador', 'Periodo', 'Días hábiles', 'Retardos', 'Faltas', 'Otras incidencias', 'Pendientes'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{visible.map(total => <tr key={total.userId} className="border-t"><td className="min-w-40 p-2">{employees.find(([id]) => id === total.userId)?.[1].name}</td><td className="whitespace-nowrap p-2">{displayDate(total.start)} — {displayDate(total.end)}</td><td className="p-2">{total.days}</td><td className="p-2">{total.late}</td><td className="p-2">{total.absences}</td><td className="p-2">{total.incidents}</td><td className="p-2">{total.pending}</td></tr>)}</tbody></table></div>
    </div>
  </section>
}
export function AttendanceReportPanel(props: Props) {
  return <div className="space-y-6"><section className="space-y-5 rounded-xl border bg-white p-4 sm:p-6"><div><h2 className="text-lg font-semibold">Líderes y colaboradores</h2><p className="mt-2 text-sm text-slate-500">Sigue las ramas de cada jefe para consultar a su equipo y abrir el detalle de cada día.</p></div>{props.stale && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Cambió una regla o referencia. RH debe actualizar el cruce; los dictámenes anteriores se conservan hasta entonces.</p>}<AttendanceLeaderList days={props.days} period={props.period} /></section><details className="rounded-xl border bg-white"><summary className="cursor-pointer p-5 text-sm font-semibold text-green-800">Resumen y gráficos del periodo</summary><AttendancePeriodSummary {...props} /></details></div>
}

