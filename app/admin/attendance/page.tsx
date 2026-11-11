import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { attendanceActor } from '@/lib/attendance/access'
import { displayDate, businessDays } from '@/lib/attendance/dates'
import { createAttendanceDraft } from '@/app/actions/attendance-imports'
import { AttendanceShell } from '@/components/attendance/shell'
import { AttendanceActionForm } from '@/components/attendance/action-form'
import { DateRangeField } from '@/components/attendance/date-range-field'
import { DeletePeriodButton } from '@/components/attendance/delete-period-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default async function AttendanceImportsPage() {
  const actor = await attendanceActor(['HR', 'ADMIN']).catch(() => null)
  if (!actor) redirect('/')
  const holidays = await prisma.holiday.findMany({ select: { date: true } })
  const batches = await prisma.attendanceImport.findMany({ orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, startDate: true, endDate: true, status: true, version: true, needsRefresh: true, _count: { select: { days: true } } } })
  return <AttendanceShell role={actor.role} title="Periodos de asistencia" description="Integra las checadas de Ajusco y Periférico, revisa la evaluación y da seguimiento a los dictámenes del equipo.">
    <div className={actor.role === 'HR' ? 'grid items-start gap-6 xl:grid-cols-[400px_minmax(0,1fr)]' : 'space-y-6'}>
      {actor.role === 'HR' && <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Importar un periodo</h2><p className="mb-5 mt-2 text-sm text-slate-500">Aquí se cruzan Ajusco y Periférico con los reportes de campo guardados para esas fechas. Revisa el resultado antes de notificar a los colaboradores.</p>
        <AttendanceActionForm action={createAttendanceDraft} label="Cargar y revisar" navigateOnId="/admin/attendance/">
          <DateRangeField />
          <div className="space-y-2"><Label htmlFor="ajusco">Archivo de Ajusco</Label><Input id="ajusco" name="AJUSCO" type="file" accept=".csv,.xlsx,.xls" required className="h-auto py-2" /></div>
          <div className="space-y-2"><Label htmlFor="periferico">Archivo de Periférico</Label><Input id="periferico" name="PERIFERICO" type="file" accept=".csv,.xlsx,.xls" required className="h-auto py-2" /></div>
          <p className="text-xs leading-relaxed text-slate-500">Conserva los encabezados originales. CSV, XLSX o XLS, hasta 3 MB por archivo. Selecciona un periodo terminado de hasta 93 días.</p>
        </AttendanceActionForm>
      </section>}
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="mb-4 text-lg font-semibold">Importaciones y reportes</h2>
        {!batches.length ? <p className="py-10 text-center text-sm text-slate-500">Todavía no hay periodos cargados.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-3">Periodo</th><th>Estado</th><th>Días hábiles</th><th><span className="sr-only">Ver</span></th></tr></thead><tbody>{batches.map(batch => <tr key={batch.id} className="border-b last:border-0"><td className="py-4 pr-4 whitespace-nowrap">{displayDate(batch.startDate)} — {displayDate(batch.endDate)}</td><td className="pr-4">{batch.status === 'DRAFT' ? 'Borrador' : batch.status === 'CLOSED' ? 'Cerrado' : 'En seguimiento'}{batch.needsRefresh && <p className="mt-1 text-xs text-amber-700">Autorizaciones por actualizar</p>}</td><td>{businessDays(batch.startDate, batch.endDate, holidays.map(h => h.date))}</td><td><Link className="font-semibold text-[#3e712c]" href={`/admin/attendance/${batch.id}`}>Abrir</Link><div className="mt-2"><DeletePeriodButton id={batch.id} version={batch.version} label={displayDate(batch.startDate) + " — " + displayDate(batch.endDate)} days={batch._count.days} /></div></td></tr>)}</tbody></table></div>}
      </section>
    </div>
    <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-600"><strong className="text-slate-900">Reglas del periodo:</strong> lunes a viernes, excepto festivos; entrada 08:00 y tolerancia hasta 08:10:59; salida 17:00. Las jornadas reducidas ajustan el horario según fecha y sede. Si falta una checada se genera incidencia; no se inventan horarios. Las autorizaciones del jefe son válidas aunque RH siga pendiente. Se suman campo y oficina sin superposición: 6 horas o más no generan incidencia de asistencia. Los retardos no se convierten en faltas.</div>
  </AttendanceShell>
}
