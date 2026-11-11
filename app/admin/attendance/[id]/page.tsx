import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { attendanceActor } from '@/lib/attendance/access'
import { evaluateImport } from '@/lib/attendance/service'
import { getFieldWork, getWorkSummary } from '@/lib/attendance/field-evidence'
import { attendanceReport } from '@/lib/attendance/report'
import { isReviewNotApplicable } from '@/lib/attendance/review-policy'
import { dateKey, displayDate } from '@/lib/attendance/dates'
import type { ImportConfiguration, Preview, SourceFile } from '@/lib/attendance/types'
import { AttendanceShell } from '@/components/attendance/shell'
import { AttendanceDraftPanel } from '@/components/attendance/draft-panel'
import { AttendancePreviewTable } from '@/components/attendance/preview-table'
import { AttendanceReportPanel } from '@/components/attendance/report-panel'
import { AttendanceActionForm } from '@/components/attendance/action-form'
import { closeAttendanceImport, refreshAttendanceImport, updateAttendanceSites } from '@/app/actions/attendance-imports'

export default async function AttendancePeriodPage({ params }: { params: { id: string } }) {
  const actor = await attendanceActor(['HR', 'ADMIN']).catch(() => null)
  if (!actor) redirect('/')
  const batch = await prisma.attendanceImport.findUnique({ where: { id: params.id } })
  if (!batch) notFound()
  const report = batch.status === 'DRAFT' ? null : await prisma.$transaction(tx => attendanceReport(tx, batch.id), { timeout: 30000, isolationLevel: 'RepeatableRead' })
  const draft = batch.status === 'DRAFT' ? await prisma.$transaction(tx => evaluateImport(tx, batch)) : null
  const employees = (report?.employees || draft?.employees || []).filter(e => !e.isBlacklisted)
  const preview = draft?.preview || batch.preview as unknown as Preview
  const sources = batch.sources as unknown as SourceFile[]
  const pending = report?.days.filter(day => day.reviewStatus !== 'RESOLVED').length || 0
  return <AttendanceShell role={actor.role} title={`${displayDate(batch.startDate)} — ${displayDate(batch.endDate)}`} description={batch.status === 'DRAFT' ? 'Revisa el cruce de ambas sedes. El borrador todavía no notifica a nadie.' : 'Sigue los dictámenes del jefe y el resumen del periodo de los colaboradores.'}>
    <div className="grid gap-3 sm:grid-cols-2">{sources.map(source => <div key={source.site} className="rounded-xl border border-slate-200 bg-white p-4"><p className="font-medium">{source.site === 'AJUSCO' ? 'Ajusco' : 'Periférico'}</p><p className="mt-1 break-all text-xs text-slate-500">{source.name}</p><p className="mt-2 text-sm">{source.rowCount} filas · {source.people.length} IDs · {source.punches.length} marcaciones</p></div>)}</div>
    {batch.status !== 'DRAFT' && actor.role === 'HR' && <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-green-800">Sedes del padrón para jornadas reducidas</summary><AttendanceActionForm action={updateAttendanceSites} label="Guardar sedes" className="mt-4"><input type="hidden" name="importId" value={batch.id} /><input type="hidden" name="version" value={batch.version} /><p className="text-xs text-slate-500">Corrige la sede si las checadas no permiten identificarla. Después actualiza el cruce del periodo.</p><div className="max-h-72 space-y-3 overflow-auto">{employees.filter(employee => (batch.configuration as unknown as ImportConfiguration).includedUserIds.includes(employee.id)).map(employee => <label key={employee.id} className="grid items-center gap-2 text-sm sm:grid-cols-2">{employee.name}<select name={'site:' + employee.id} defaultValue={(batch.configuration as unknown as ImportConfiguration).sites?.[employee.id] || ''} className="h-10 rounded-md border bg-white px-2"><option value="">Según las checadas</option><option value="AJUSCO">Ajusco</option><option value="PERIFERICO">Periférico</option></select></label>)}</div></AttendanceActionForm></details>}
    {batch.status === 'DRAFT' ? actor.role === 'HR' ? <AttendanceDraftPanel key={batch.version} id={batch.id} version={batch.version} initialConfig={batch.configuration as unknown as ImportConfiguration} preview={preview} employees={employees} /> : <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><div><h2 className="text-lg font-semibold">Vista previa por líder</h2><p className="mt-2 text-sm text-slate-500">Borrador en preparación. RH revisa la configuración y confirma la publicación.</p></div><AttendancePreviewTable days={preview.days} employees={employees} period={preview.period} /></section> : report && <>
      <div className="flex flex-wrap items-start justify-between gap-5 rounded-xl border border-slate-200 bg-white p-5">
        <div><p className="font-semibold">{batch.status === 'CLOSED' ? 'Periodo cerrado' : 'Periodo publicado'} · {pending} días por resolver</p><p className="mt-1 text-xs text-slate-500">El Excel incluye resumen del periodo, detalle con justificaciones y referencias de ambos archivos.</p>{!report.stale ? <Link href={`/api/attendance/${batch.id}/export`} className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-green-300 px-4 text-sm font-semibold text-green-800">Descargar Excel {batch.status === 'CLOSED' ? '' : '(provisional)'}</Link> : <p className="mt-3 text-sm text-amber-800">Actualiza el cruce de checadas, reportes de campo y autorizaciones para habilitar la descarga.</p>}</div>
        {actor.role === 'HR' && (report.stale ? <AttendanceActionForm action={refreshAttendanceImport} label="Actualizar cruce y autorizaciones"><input type="hidden" name="importId" value={batch.id} /><input type="hidden" name="version" value={batch.version} /><p className="max-w-sm text-xs text-slate-500">Los dictámenes cuya evidencia cambió se reabrirán. Se conserva su historial y se notificará a los colaboradores afectados.</p></AttendanceActionForm> : batch.status !== 'CLOSED' && <AttendanceActionForm action={closeAttendanceImport} label="Cerrar periodo" disabled={pending > 0}><input type="hidden" name="importId" value={batch.id} /><input type="hidden" name="version" value={batch.version} /></AttendanceActionForm>)}
      </div>
      <AttendanceReportPanel period={report.period} stale={report.stale} totals={report.totals} days={report.days.map(day => ({ id: day.id, userId: day.userId, managerId: day.managerId, date: dateKey(day.date), user: day.user, manager: day.manager, entrySeconds: day.entrySeconds, exitSeconds: day.exitSeconds, exitEstimated: day.exitEstimated, detectedIssues: day.detectedIssues, coverage: day.coverage, reviewStatus: day.reviewStatus, decision: day.decision, justification: day.justification, managerComment: day.managerComment, fieldWork: getFieldWork(day.evidence), workSummary: getWorkSummary(day.evidence), systemNotes: day.systemNotes, reviewNotApplicable: isReviewNotApplicable(day.evidence) }))} />
    </>}
  </AttendanceShell>
}
