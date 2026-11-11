import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { attendanceActor } from '@/lib/attendance/access'
import { dateKey, displayDate, displayTime, businessDays } from '@/lib/attendance/dates'
import { SITE_LABELS } from '@/lib/attendance/workday'
import { saveReducedWorkday, cancelReducedWorkday } from '@/app/actions/reduced-workdays'
import { AttendanceShell } from '@/components/attendance/shell'
import { AttendanceActionForm } from '@/components/attendance/action-form'
import { DateRangeField } from '@/components/attendance/date-range-field'
import { Input } from '@/components/ui/input'

export default async function ReducedWorkdaysPage() {
  const actor = await attendanceActor(['HR', 'ADMIN']).catch(() => null)
  if (!actor) redirect('/')
  const [rules, holidays] = await Promise.all([
    prisma.reducedWorkday.findMany({ orderBy: { startDate: 'desc' }, take: 200 }),
    prisma.holiday.findMany({ select: { date: true } }),
  ])
  const fields = (rule?: typeof rules[number]) => <>
    {rule && <><input type="hidden" name="id" value={rule.id} /><input type="hidden" name="version" value={rule.version} /></>}
    <DateRangeField initialStart={rule ? dateKey(rule.startDate) : ''} initialEnd={rule ? dateKey(rule.endDate) : ''} />
    <label className="block space-y-2 text-sm font-medium">Sede<select name="site" required defaultValue={rule?.site || 'BOTH'} className="h-11 w-full rounded-lg border bg-white px-3">{Object.entries(SITE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Entrada<Input type="time" name="startTime" min="08:00" max="16:59" step={60} defaultValue={rule ? displayTime(rule.startSeconds).slice(0, 5) : '08:00'} required /></label><label className="space-y-2 text-sm font-medium">Salida<Input type="time" name="endTime" min="08:01" max="17:00" step={60} defaultValue={rule ? displayTime(rule.endSeconds).slice(0, 5) : '11:00'} required /></label></div>
    <label className="block space-y-2 text-sm font-medium">Motivo o notas<Input name="notes" maxLength={1000} defaultValue={rule?.notes || ''} placeholder="Ejemplo: jornada especial de fin de año" /></label>
  </>
  return <AttendanceShell role={actor.role} title="Días de jornada corta o reducida" description="Define las fechas y el horario especial de Ajusco, Periférico o ambas sedes. RH y Admin pueden registrar, editar y cancelar jornadas.">
    <div className="grid items-start gap-6 xl:grid-cols-[410px_minmax(0,1fr)]">
      <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 text-lg font-semibold">Nueva jornada reducida</h2><AttendanceActionForm action={saveReducedWorkday} label="Guardar jornada">{fields()}</AttendanceActionForm><p className="mt-4 text-xs leading-relaxed text-slate-500">La tolerancia de entrada es de 10 minutos. Se aplican únicamente los días hábiles del periodo. La regla de 6 horas de trabajo de campo se mantiene.</p></section>
      <section className="space-y-4"><h2 className="text-lg font-semibold">Jornadas registradas</h2>{!rules.length && <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Aún no hay jornadas reducidas. El horario habitual es de 08:00 a 17:00.</p>}
        {rules.map(rule => <article key={rule.id} className={'rounded-xl border-l-4 bg-white p-5 shadow-sm ' + (rule.cancelledAt ? 'border-slate-300 opacity-70' : rule.site === 'AJUSCO' ? 'border-blue-600' : rule.site === 'PERIFERICO' ? 'border-violet-600' : 'border-teal-600')}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{SITE_LABELS[rule.site]}</h3><span className="rounded-md bg-slate-100 px-3 py-1 text-xs">{rule.cancelledAt ? 'Cancelada' : 'Vigente para las fechas indicadas'}</span></div>
          <p className="mt-3 text-xl font-semibold">{displayTime(rule.startSeconds).slice(0, 5)} — {displayTime(rule.endSeconds).slice(0, 5)}</p><p className="mt-2 text-sm">{displayDate(rule.startDate)} — {displayDate(rule.endDate)} · Días hábiles: {businessDays(rule.startDate, rule.endDate, holidays.map(h => h.date))}</p>
          {rule.notes && <p className="mt-3 break-words text-sm text-slate-600">{rule.notes}</p>}
          {!rule.cancelledAt && <div className="mt-4 space-y-4 border-t pt-4"><details><summary className="cursor-pointer font-medium text-green-800">Editar jornada</summary><AttendanceActionForm key={rule.version} className="mt-4" action={saveReducedWorkday} label="Guardar cambios">{fields(rule)}</AttendanceActionForm></details><details><summary className="cursor-pointer text-sm text-red-700">Cancelar jornada</summary><AttendanceActionForm action={cancelReducedWorkday} label="Confirmar cancelación" className="mt-3"><input type="hidden" name="id" value={rule.id} /><input type="hidden" name="version" value={rule.version} /><p className="text-sm text-slate-600">El registro se conservará. Los periodos afectados quedarán pendientes de actualizar desde Biochecadores.</p></AttendanceActionForm></details></div>}
        </article>)}
      </section>
    </div>
  </AttendanceShell>
}

