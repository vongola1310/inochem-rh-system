import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { attendanceActor } from '@/lib/attendance/access'
import { dateKey, displayDate } from '@/lib/attendance/dates'
import { LEAVE_LABELS } from '@/lib/attendance/types'
import { saveMedicalLeave, cancelMedicalLeave } from '@/app/actions/medical-leaves'
import { AttendanceShell } from '@/components/attendance/shell'
import { AttendanceActionForm } from '@/components/attendance/action-form'
import { DateRangeField } from '@/components/attendance/date-range-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export default async function MedicalLeavesPage() {
  const actor = await attendanceActor(['HR', 'ADMIN']).catch(() => null)
  if (!actor) redirect('/')
  const [employees, leaves] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, employeeNumber: true }, orderBy: { name: 'asc' } }),
    prisma.medicalLeave.findMany({ include: { user: { select: { name: true, employeeNumber: true } } }, orderBy: { startDate: 'desc' }, take: 200 }),
  ])
  const fields = (leave?: typeof leaves[number]) => <>
    {leave ? <><input type="hidden" name="id" value={leave.id} /><input type="hidden" name="version" value={leave.version} /><input type="hidden" name="userId" value={leave.userId} /></> : <label className="block space-y-2 text-sm font-medium">Colaborador<select name="userId" required defaultValue="" className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal"><option value="" disabled>Selecciona un colaborador</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name} · {e.employeeNumber}</option>)}</select></label>}
    <DateRangeField initialStart={leave ? dateKey(leave.startDate) : ''} initialEnd={leave ? dateKey(leave.endDate) : ''} calendarDayCount />
    <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Serie<Input name="series" required maxLength={40} defaultValue={leave?.series} /></label><label className="space-y-2 text-sm font-medium">Folio<Input name="folio" required maxLength={100} defaultValue={leave?.folio} /></label></div>
    <label className="block space-y-2 text-sm font-medium">Tipo<select name="kind" required defaultValue={leave?.kind || 'GENERAL'} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal">{Object.entries(LEAVE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="block space-y-2 text-sm font-medium">Notas<Textarea name="notes" maxLength={4000} rows={3} defaultValue={leave?.notes || ''} placeholder="Observaciones para RH y administración" /></label>
  </>
  return <AttendanceShell role={actor.role} title="Incapacidades" description="Registra periodos completos con días corridos. Solo RH y administración pueden consultar los datos y las notas de estos registros.">
    <div className="grid items-start gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="mb-5 text-lg font-semibold">Registrar incapacidad</h2><AttendanceActionForm action={saveMedicalLeave} label="Guardar incapacidad">{fields()}</AttendanceActionForm></section>
      <section className="min-w-0 space-y-4"><h2 className="text-lg font-semibold">Registros recientes</h2>{!leaves.length && <p className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">No hay incapacidades registradas.</p>}
        {leaves.map(leave => <article key={leave.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{leave.user.name}</h3><p className="mt-1 text-xs text-slate-500">#{leave.user.employeeNumber} · Serie {leave.series} · Folio {leave.folio}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${leave.cancelledAt ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-800'}`}>{leave.cancelledAt ? 'Cancelada' : LEAVE_LABELS[leave.kind]}</span></div>
          <p className="mt-4 text-sm">{displayDate(leave.startDate)} — {displayDate(leave.endDate)} <strong className="ml-2">{leave.calendarDays} días corridos</strong></p>
          {leave.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-600">{leave.notes}</p>}
          {leave.cancelledAt ? <p className="mt-3 text-sm text-slate-500">Motivo de cancelación: {leave.cancelReason}</p> : <div className="mt-4 space-y-3 border-t pt-4">
            <details><summary className="cursor-pointer text-sm font-semibold text-[#3e712c]">Editar registro</summary><AttendanceActionForm key={leave.version} className="mt-4" action={saveMedicalLeave} label="Guardar cambios">{fields(leave)}</AttendanceActionForm></details>
            <details><summary className="cursor-pointer text-sm text-red-700">Cancelar incapacidad</summary><AttendanceActionForm className="mt-4" action={cancelMedicalLeave} label="Confirmar cancelación"><input type="hidden" name="id" value={leave.id} /><input type="hidden" name="version" value={leave.version} /><label className="block text-sm">Motivo<Textarea name="reason" required minLength={5} maxLength={500} /></label></AttendanceActionForm></details>
          </div>}
        </article>)}
      </section>
    </div>
  </AttendanceShell>
}
