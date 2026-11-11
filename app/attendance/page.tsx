import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { attendanceActor } from '@/lib/attendance/access'
import { displayDate, displayTime, displayWeekday, weekStart, addDateDays } from '@/lib/attendance/dates'
import { DECISION_LABELS, REVIEW_LABELS } from '@/lib/attendance/types'
import { AttendanceDecisionBadge, AttendanceIssueLabels, attendanceCardColors } from '@/components/attendance/incident-label'
import { isReviewNotApplicable, NOT_APPLICABLE_LABEL } from '@/lib/attendance/review-policy'
import { AttendanceShell } from '@/components/attendance/shell'
import { AttendanceActionForm } from '@/components/attendance/action-form'
import { reviewAttendanceDay } from '@/app/actions/attendance-review'
import { ATTENDANCE_CATEGORIES } from '@/lib/attendance/categories'
import { attendanceCategoryWhere } from '@/lib/attendance/category-query'
import { FieldEvidence } from '@/components/attendance/field-evidence'
import { getFieldWork, getWorkSummary } from '@/lib/attendance/field-evidence'
import { Textarea } from '@/components/ui/textarea'

export default async function MyAttendancePage({ searchParams }: { searchParams: { view?: string; period?: string; state?: string; category?: string; page?: string } }) {
  const actor = await attendanceActor().catch(() => null)
  if (!actor) redirect('/login')
  const team = searchParams.view === 'team'
  const owner: Prisma.AttendanceDayWhereInput = { isWorkday: true, user: { isBlacklisted: false }, ...(team ? { managerId: actor.id, userId: { not: actor.id } } : { userId: actor.id }) }
  const state = ['WAITING_EMPLOYEE', 'WAITING_MANAGER', 'RESOLVED'].includes(searchParams.state || '') ? searchParams.state : undefined
  const category = searchParams.category && ATTENDANCE_CATEGORIES[searchParams.category] ? searchParams.category : 'all'
  const page = Math.max(1, Math.min(10000, Number.parseInt(searchParams.page || '1', 10) || 1))
  const where: Prisma.AttendanceDayWhereInput = { ...owner, ...attendanceCategoryWhere(category), ...(searchParams.period ? { importId: searchParams.period } : {}), ...(state ? { reviewStatus: state === 'RESOLVED' ? 'RESOLVED' : { in: ['WAITING_EMPLOYEE', 'WAITING_MANAGER'] } } : {}) }
  const pageSize = team ? 5 : 30
  const [batches, count, peopleCount, people] = await Promise.all([
    prisma.attendanceImport.findMany({ where: { days: { some: owner } }, select: { id: true, startDate: true, endDate: true }, orderBy: { startDate: 'desc' } }),
    prisma.attendanceDay.count({ where }),
    team ? prisma.user.count({ where: { attendanceDays: { some: where } } }) : Promise.resolve(0),
    team ? prisma.user.findMany({ where: { attendanceDays: { some: where } }, select: { id: true, name: true, employeeNumber: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: pageSize, skip: (page - 1) * pageSize }) : Promise.resolve([]),
  ])
  // Paginar colaboradores conserva juntos todos sus días y mantiene el alcance del responsable.
  const days = await prisma.attendanceDay.findMany({
    where: team ? { AND: [where, { userId: { in: people.map(person => person.id) } }] } : where,
    include: { user: { select: { name: true, employeeNumber: true } }, manager: { select: { name: true } }, batch: { select: { status: true, needsRefresh: true } } },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    ...(team ? {} : { take: pageSize, skip: (page - 1) * pageSize }),
  })
  const pageCount = Math.max(1, Math.ceil((team ? peopleCount : count) / pageSize))
  const weeks = [...new Set(days.map(day => weekStart(day.date)))]
  const linkForPage = (next: number) => '/attendance?' + new URLSearchParams({ ...(team ? { view: 'team' } : {}), ...(searchParams.period ? { period: searchParams.period } : {}), ...(state ? { state } : {}), category, page: String(next) })
  const renderDay = (day: typeof days[number]) => <article key={day.id} className={'rounded-xl border p-5 sm:p-6 ' + attendanceCardColors({ ...day, reviewNotApplicable: isReviewNotApplicable(day.evidence) })}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold"><span className="block text-base">{displayWeekday(day.date)}</span><span className="mt-1 block text-sm font-normal text-slate-500">{displayDate(day.date)}</span></h3></div><span className={`rounded-full px-3 py-1 text-xs ${day.reviewStatus === 'RESOLVED' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-800'}`}>{isReviewNotApplicable(day.evidence) ? NOT_APPLICABLE_LABEL : REVIEW_LABELS[day.reviewStatus]}</span></div>
      <dl className="my-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-sm"><div><dt className="text-xs text-slate-500">Entrada</dt><dd className="mt-1 font-medium">{displayTime(day.entrySeconds)}</dd></div><div><dt className="text-xs text-slate-500">Salida</dt><dd className="mt-1 font-medium">{displayTime(day.exitEstimated ? null : day.exitSeconds)}</dd></div></dl>
      <div className="text-sm font-medium">{isReviewNotApplicable(day.evidence) ? 'Fuera del proceso de incidencias' : <AttendanceIssueLabels day={day} />}</div>
      {!!day.coverage.length && <p className="mt-2 text-xs text-green-800">Autorizaciones: {day.coverage.join(' · ')}</p>}
      <FieldEvidence rows={getFieldWork(day.evidence)} summary={getWorkSummary(day.evidence)} />
      {day.systemNotes.filter(note => !note.startsWith('Salida asignada automáticamente')).map(note => <p key={note} className="mt-2 text-xs text-slate-500">{note}</p>)}
      <p className="mt-3 text-xs text-slate-500">Responsable: {isReviewNotApplicable(day.evidence) ? NOT_APPLICABLE_LABEL : day.manager?.name || 'Sin revisión requerida'}</p>
      {day.justification && <div className="mt-4 rounded-lg border border-slate-200 p-3"><p className="text-xs font-semibold text-slate-500">Justificación anterior del colaborador</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{day.justification}</p></div>}
      {day.managerComment && <div className="mt-3 rounded-lg bg-blue-50 p-3"><p className="text-xs font-semibold text-blue-800">{isReviewNotApplicable(day.evidence) ? NOT_APPLICABLE_LABEL : DECISION_LABELS[day.decision]} · Comentario del responsable</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{day.managerComment}</p></div>}
      {day.batch.needsRefresh && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">RH debe actualizar las autorizaciones de este periodo antes de continuar.</p>}
      {team && !isReviewNotApplicable(day.evidence) && ['WAITING_EMPLOYEE', 'WAITING_MANAGER'].includes(day.reviewStatus) && <AttendanceActionForm className="mt-4 border-t pt-4" action={reviewAttendanceDay} label="Guardar y enviar dictamen a RH" disabled={day.batch.needsRefresh || day.batch.status !== 'PUBLISHED'}><input type="hidden" name="dayId" value={day.id} /><input type="hidden" name="version" value={day.version} /><label className="block space-y-2 text-sm font-medium">Dictamen<select name="decision" required defaultValue="" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal"><option value="" disabled>Selecciona el resultado de la revisión</option>{['JUSTIFIED', 'INCIDENT', 'LATE', 'ABSENCE', 'EARLY_EXIT', 'LATE_EARLY_EXIT'].map(value => <option key={value} value={value}>{DECISION_LABELS[value]}</option>)}</select></label><label className="block space-y-2 text-sm font-medium">Motivo del dictamen<Textarea name="comment" required minLength={5} maxLength={4000} rows={3} placeholder="Explica la aprobación o la clasificación de la incidencia." /></label></AttendanceActionForm>}
      {day.reviewStatus === 'RESOLVED' && !day.managerComment && <div className="mt-4 text-sm font-medium">{isReviewNotApplicable(day.evidence) ? NOT_APPLICABLE_LABEL : <AttendanceDecisionBadge day={day} />}</div>}
    </article>
  return <AttendanceShell role={actor.role} title={team ? 'Dictámenes a mi cargo' : 'Mi asistencia e incidencias'} description={team ? 'Abre cada colaborador para revisar sus días en orden de fecha, aprobar o clasificar sus incidencias y consultar los dictámenes resueltos.' : 'Consulta tus incidencias por semana y día, en orden de fecha. Esta vista es de solo lectura; aquí aparecerán los dictámenes de tu jefe.'}>
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      {team && <input type="hidden" name="view" value="team" />}
      <label className="space-y-1 text-xs text-slate-500">Periodo<select name="period" defaultValue={searchParams.period || ''} className="block h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"><option value="">Todos los periodos</option>{batches.map(batch => <option key={batch.id} value={batch.id}>{displayDate(batch.startDate)} — {displayDate(batch.endDate)}</option>)}</select></label>
      <label className="space-y-1 text-xs text-slate-500">Estado<select name="state" defaultValue={state || ''} className="block h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"><option value="">Todos los estados</option>{Object.entries(REVIEW_LABELS).filter(([value]) => value !== 'WAITING_EMPLOYEE').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="space-y-1 text-xs text-slate-500">Tipo<select name="category" defaultValue={category} className="block h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800">{Object.entries(ATTENDANCE_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="h-11 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white">Filtrar</button><p className="ml-auto text-sm text-slate-500">{team && `${peopleCount} colaboradores · `}{count} registros</p>
    </form>
    {!days.length && <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">{team ? 'No hay registros a tu cargo con estos filtros.' : 'No hay registros de asistencia con estos filtros.'}</div>}
    {team ? <div className="space-y-5">{people.map((person, index) => {
      const employeeDays = days.filter(day => day.userId === person.id)
      const pending = employeeDays.filter(day => day.reviewStatus !== 'RESOLVED').length
      return <details key={person.id} open={index === 0} data-attendance-employee={person.id} className="group rounded-xl border border-blue-200 bg-white">
        <summary className="cursor-pointer rounded-t-xl border-l-4 border-blue-600 bg-blue-50/70 p-5 text-blue-950"><span className="ml-2 inline-flex max-w-full flex-wrap items-center gap-3 align-middle"><span><span className="block font-semibold">{person.name}</span><span className="mt-1 block text-xs">Empleado #{person.employeeNumber}</span></span><span className="rounded-md bg-white px-3 py-1 text-xs">{employeeDays.length} registros · {pending} por revisar · {employeeDays.length - pending} resueltos</span></span></summary>
        <div className="grid items-start gap-4 border-t border-blue-100 p-3 sm:p-5 xl:grid-cols-2">{employeeDays.map(renderDay)}</div>
      </details>
    })}</div> : <div className="space-y-6">{weeks.map(start => <section key={start} data-attendance-week={start} className="space-y-3"><h2 className="rounded-lg border-l-4 border-green-600 bg-green-50 px-4 py-3 text-sm font-semibold text-green-950">Semana del {displayDate(start)} al {displayDate(addDateDays(start, 6))}</h2><div className="grid items-start gap-4 xl:grid-cols-2">{days.filter(day => weekStart(day.date) === start).map(renderDay)}</div></section>)}</div>}
    <div className="flex items-center justify-end gap-4 text-sm">{page > 1 && <Link className="rounded-lg border bg-white px-3 py-2" href={linkForPage(page - 1)}>Anterior</Link>}<span>Página {page} de {pageCount}{team ? ' · 5 colaboradores por página' : ''}</span>{page < pageCount && <Link className="rounded-lg border bg-white px-3 py-2" href={linkForPage(page + 1)}>Siguiente</Link>}</div>
  </AttendanceShell>
}
