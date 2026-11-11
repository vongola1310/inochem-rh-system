import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fieldReportActor } from '@/lib/field-reports/access'
import { ensureFieldReportReminder } from '@/lib/field-reports/reminders'
import { addDateDays, dateKey, displayDate, todayInMexico } from '@/lib/attendance/dates'
import { AttendanceShell } from '@/components/attendance/shell'
import { AttendanceActionForm } from '@/components/attendance/action-form'
import { DateRangeField } from '@/components/attendance/date-range-field'
import { Input } from '@/components/ui/input'
import { createFieldReport } from '@/app/actions/field-reports'
import type { FieldSource } from '@/lib/field-reports/types'

export default async function FieldReportsPage() {
  const actor = await fieldReportActor().catch(() => null)
  if (!actor) redirect('/')
  if (actor.receivesFieldReportReminders) await ensureFieldReportReminder(actor.id)
  const [reports, schedule] = await Promise.all([
    prisma.fieldReport.findMany({ where: ['HR', 'ADMIN'].includes(actor.role) ? {} : { managerId: actor.id }, orderBy: { createdAt: 'desc' }, take: 100, include: { manager: { select: { name: true } } } }),
    actor.receivesFieldReportReminders ? prisma.fieldReportSchedule.findUnique({ where: { userId: actor.id } }) : null,
  ])
  const today = todayInMexico()
  return <AttendanceShell role={actor.role} title="Reportes de personal de campo" description="Gibran, RH y Admin pueden guardar el Excel de Salesforce como referencia para el siguiente cruce de biochecadores.">
    <section className="space-y-5 rounded-xl border bg-white p-5 sm:p-6"><div className="flex flex-wrap justify-between gap-3"><h2 className="text-lg font-semibold">Guardar reporte de personal de campo</h2>{schedule && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{dateKey(schedule.nextDueDate) <= today ? 'Carga pendiente desde ' : 'Próximo recordatorio: '}{displayDate(schedule.nextDueDate)}</p>}</div><p className="text-sm text-slate-600">Sube el archivo cada 14 días e indica el periodo al que corresponde. La plataforma lo conservará para combinarlo con las checadas de oficina cuando se importe el periodo.</p>
      <AttendanceActionForm action={createFieldReport} label="Guardar archivo de referencia" navigateOnId="/field-reports/"><DateRangeField initialStart={addDateDays(today, -14)} initialEnd={addDateDays(today, -1)} /><label className="block space-y-2 text-sm font-medium">Excel de Salesforce (SA_RH)<Input name="report" type="file" accept=".xlsx,.xls" required className="h-auto py-2" /></label><p className="text-xs text-slate-500">Conserva las columnas originales. Hasta 3 MB. El archivo quedará disponible al guardarlo, sin una confirmación adicional.</p></AttendanceActionForm>
    </section>
    <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 text-lg font-semibold">Archivos de referencia</h2>{!reports.length ? <p className="py-8 text-center text-sm text-slate-500">Todavía no hay reportes de campo.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Archivo / periodo', 'Cargado por', 'Estado', 'Registros', ''].map((label, i) => <th key={i} className="p-3">{label}</th>)}</tr></thead><tbody>{reports.map(report => { const source = report.source as unknown as FieldSource; return <tr key={report.id} className="border-t"><td className="p-3"><p className="break-words font-medium">{source.fileName}</p><p className="mt-1 whitespace-nowrap text-xs text-slate-500">{displayDate(report.startDate)} — {displayDate(report.endDate)}</p></td><td className="p-3">{report.manager.name}</td><td className="p-3">{report.status === 'DRAFT' ? 'Borrador anterior' : report.status === 'CONFIRMED' ? 'Referencia guardada' : 'Cancelado'}</td><td className="p-3">{source.records.length}</td><td className="p-3"><Link className="font-medium text-green-800" href={'/field-reports/' + report.id}>Ver archivo</Link></td></tr> })}</tbody></table></div>}</section>
  </AttendanceShell>
}

