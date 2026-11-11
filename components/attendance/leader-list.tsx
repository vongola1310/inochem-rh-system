'use client'

import { useId, useMemo, useState } from 'react'
import { ChevronDown, Users, UserRound, GitBranch } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { displayDate, displayTime } from '@/lib/attendance/dates'
import { DECISION_LABELS } from '@/lib/attendance/types'
import { AttendanceDecisionBadge, AttendanceIssueLabels, attendanceCardColors, attendanceTone, hasHighlightedAbsence, hasHighlightedLate, hasNoActiveIncident } from './incident-label'
import { FieldEvidence } from './field-evidence'
import { NOT_APPLICABLE_LABEL } from '@/lib/attendance/review-policy'
import { ATTENDANCE_CATEGORIES } from '@/lib/attendance/categories'
import { attendanceCounts, groupAttendanceByLeader, type AttendanceDisplayDay, type AttendancePersonGroup } from '@/lib/attendance/grouping'

type Period = { start: string; end: string; businessDays: number }
function periodCaption(period: Period) { return displayDate(period.start) + ' — ' + displayDate(period.end) + ' · ' + period.businessDays + ' días hábiles' }

function StatusCounts({ days, preview }: { days: AttendanceDisplayDay[]; preview: boolean }) {
  const count = attendanceCounts(days)
  const items: { label: string; value: number; color: string }[] = []
  const otherIncidents = days.filter(day => attendanceTone(day) === 'incident').length
  if (otherIncidents) items.push({ label: 'Otras incidencias', value: otherIncidents, color: 'bg-violet-700 text-white' })
  const clearDays = days.filter(hasNoActiveIncident).length
  if (clearDays) items.unshift({ label: 'Sin incidencias', value: clearDays, color: 'bg-green-700 text-white' })
  const lateDays = days.filter(hasHighlightedLate)
  const pendingLate = lateDays.filter(day => day.reviewStatus !== 'RESOLVED').length
  if (pendingLate) items.unshift({ label: preview ? 'Retardos detectados' : 'Retardos por revisar', value: pendingLate, color: 'bg-orange-700 text-white' })
  if (lateDays.length > pendingLate) items.unshift({ label: 'Retardos confirmados', value: lateDays.length - pendingLate, color: 'bg-orange-700 text-white' })
  if (count.notApplicable) items.push({ label: 'N/A', value: count.notApplicable, color: 'bg-slate-100 text-slate-600' })
  const absences = days.filter(hasHighlightedAbsence)
  const pendingAbsences = absences.filter(day => day.reviewStatus !== 'RESOLVED').length
  const confirmedAbsences = absences.length - pendingAbsences
  if (pendingAbsences) items.unshift({ label: preview ? 'Faltas detectadas' : 'Faltas por revisar', value: pendingAbsences, color: 'bg-red-700 text-white' })
  if (confirmedAbsences) items.unshift({ label: 'Faltas confirmadas', value: confirmedAbsences, color: 'bg-red-700 text-white' })
  return <span className="flex flex-wrap gap-2">{items.filter(item => item.value > 0).map(item => <span key={item.label} className={`rounded-md px-2 py-1 text-xs font-medium ${item.color}`}>{item.label}: {item.value}</span>)}</span>
}

function AttendanceDayCard({ day, preview }: { day: AttendanceDisplayDay; preview: boolean }) {
  return <article className={'min-w-0 rounded-lg border p-4 ' + attendanceCardColors(day)}>
    <div className="flex flex-wrap items-start justify-between gap-2"><h5 className="text-sm font-semibold">{displayDate(day.date)}</h5>{!day.reviewNotApplicable && !preview && day.reviewStatus === 'RESOLVED' ? <AttendanceDecisionBadge day={day} /> : <span className="text-xs font-medium text-slate-600">{day.reviewNotApplicable ? NOT_APPLICABLE_LABEL : preview ? 'Evaluación inicial' : DECISION_LABELS[day.decision]}</span>}</div>
    <dl className="my-3 grid grid-cols-2 gap-3 rounded-md bg-slate-50 p-3 text-xs"><div><dt className="text-slate-500">Entrada</dt><dd className="mt-1 font-medium">{displayTime(day.entrySeconds)}</dd></div><div><dt className="text-slate-500">Salida</dt><dd className="mt-1 font-medium">{displayTime(day.exitEstimated ? null : day.exitSeconds)}</dd></div></dl>
    {day.reviewNotApplicable ? <p className="text-sm">Conserva checadas, sin proceso de incidencias.</p> : <AttendanceIssueLabels day={day} />}
    {!!day.coverage.length && <p className="mt-2 text-xs text-green-800">{day.coverage.join(' · ')}</p>}
    {day.systemNotes?.filter(note => !note.startsWith('Salida asignada automáticamente')).map(note => <p key={note} className="mt-2 text-xs leading-relaxed text-slate-500">{note}</p>)}
    {!preview && (day.justification || day.managerComment) && <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-xs leading-relaxed"><div hidden={!day.justification}><p className="font-semibold text-slate-500">Justificación anterior del colaborador</p><p className="mt-1 whitespace-pre-wrap break-words">{day.justification}</p></div>{day.managerComment && <div className="rounded-md bg-blue-50 p-3"><p className="font-semibold text-blue-900">Dictamen de {day.manager?.name || 'su responsable'}</p><p className="mt-1 whitespace-pre-wrap break-words">{day.managerComment}</p></div>}</div>}
    <FieldEvidence rows={day.fieldWork || []} summary={day.workSummary} />
    {day.punches && <details className="mt-3 text-xs"><summary className="cursor-pointer py-1 font-medium text-[#3e712c]">Ver checadas de origen</summary><ul className="mt-2 space-y-1 text-slate-600">{day.punches.map((punch, index) => <li key={index}>{punch.site === 'AJUSCO' ? 'Ajusco' : 'Periférico'} · {displayTime(punch.seconds)} · fila {punch.row}</li>)}{!day.punches.length && <li>No hay marcaciones para este día.</li>}</ul></details>}
  </article>
}

function EmployeeIncidences({ person, preview, period }: { person: AttendancePersonGroup; preview: boolean; period: Period }) {
  const [open, setOpen] = useState(false), [page, setPage] = useState(1), id = useId()
  const pages = Math.max(1, Math.ceil(person.days.length / 10)), current = Math.min(page, pages)
  return <div className={'min-w-0 rounded-lg border bg-white shadow-sm ' + (person.days.some(hasHighlightedAbsence) ? 'border-red-300' : person.days.some(hasHighlightedLate) ? 'border-orange-300' : person.days.every(hasNoActiveIncident) ? 'border-green-300' : 'border-violet-300')} data-attendance-person={person.userId}>
    <h4><button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 rounded-lg p-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e712c]">
      <UserRound className="mt-1 h-4 w-4 shrink-0 text-slate-400" /><span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold">{person.user.name}</span><span className="mb-2 mt-1 block text-xs text-slate-500">#{person.user.employeeNumber} · {periodCaption(period)}</span><StatusCounts days={person.days} preview={preview} /></span><ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button></h4>
    <div id={id} hidden={!open}>{open && <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-3 sm:p-4"><div className="grid gap-3 lg:grid-cols-2">{person.days.slice((current - 1) * 10, current * 10).map(day => <AttendanceDayCard key={day.id} day={day} preview={preview} />)}</div>{pages > 1 && <div className="flex flex-wrap items-center justify-end gap-3 text-xs"><button type="button" disabled={current <= 1} className="min-h-10 rounded-md border bg-white px-3 disabled:opacity-40" onClick={() => setPage(current - 1)}>Anterior</button><span>Página {current} de {pages}</span><button type="button" disabled={current >= pages} className="min-h-10 rounded-md border bg-white px-3 disabled:opacity-40" onClick={() => setPage(current + 1)}>Siguiente</button></div>}</div>}</div>
  </div>
}

export function AttendanceLeaderList({ days, preview = false, period }: { days: AttendanceDisplayDay[]; preview?: boolean; period?: Period }) {
  const dates = [...new Set(days.map(day => day.date))].sort()
  const shownPeriod = period || { start: dates[0] || '', end: dates[dates.length - 1] || '', businessDays: dates.length }
  const palette = ['#2563eb', '#7c3aed', '#0f766e', '#c2410c', '#0369a1']
  const [search, setSearch] = useState(''), [state, setState] = useState('all'), [onlyIssues, setOnlyIssues] = useState(false), [category, setCategory] = useState('all')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({}), prefix = useId()
  const groups = useMemo(() => groupAttendanceByLeader(days, { search, state, onlyIssues, category }), [days, search, state, onlyIssues, category])
  const searching = !!search.trim() || state !== 'all' || onlyIssues || category !== 'all'
  const shownDays = groups.flatMap(group => group.days), people = new Set(shownDays.map(day => day.userId)).size
  return <section aria-label={preview ? 'Vista previa por líder' : 'Incidencias por líder'} className="space-y-4">
    <div className="flex flex-wrap items-end gap-3"><label className="w-full min-w-0 space-y-2 text-xs font-medium text-slate-600 sm:w-auto sm:flex-1">Buscar líder o colaborador<Input type="search" value={search} onChange={e => { setSearch(e.target.value); setOpenGroups({}) }} placeholder="Nombre del jefe, colaborador, número o fecha…" className="h-11 min-w-0 bg-white" /></label><label className="w-full space-y-2 text-xs font-medium text-slate-600 sm:w-auto">Tipo<select aria-label="Tipo de registro" className="block h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal" value={category} onChange={e => { setCategory(e.target.value); setOpenGroups({}) }}>{Object.entries(ATTENDANCE_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{!preview && <label className="w-full space-y-2 text-xs font-medium text-slate-600 sm:w-auto">Estado<select aria-label="Estado de revisión" className="block h-11 w-full max-w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal" value={state} onChange={e => { setState(e.target.value); setOpenGroups({}) }}><option value="all">Todos los estados</option><option value="WAITING_MANAGER">Revisión del jefe</option><option value="RESOLVED">Resueltos</option><option value="NA">N/A — No aplica</option></select></label>}</div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs"><label className="flex min-h-10 items-center gap-2 text-slate-600"><input type="checkbox" checked={onlyIssues} onChange={e => { setOnlyIssues(e.target.checked); setOpenGroups({}) }} />Solo días con incidencias</label><div className="flex flex-wrap gap-2"><button type="button" className="min-h-10 rounded-md border border-slate-200 bg-white px-3 font-medium text-[#3e712c]" onClick={() => setOpenGroups(Object.fromEntries(groups.map(group => [group.id, true])))}>Expandir líderes</button><button type="button" className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-slate-600" onClick={() => setOpenGroups(Object.fromEntries(groups.map(group => [group.id, false])))}>Contraer líderes</button></div></div>
    <p className="text-xs text-slate-500" aria-live="polite">{groups.filter(group => group.kind === 'leader').length} líderes · {people} colaboradores · {periodCaption(shownPeriod)}</p>
    {!groups.length && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No hay resultados con estos filtros.</p>}
    {groups.map((group, index) => {
      const color = palette[index % palette.length]
      const open = openGroups[group.id] ?? searching, panelId = `${prefix}-${index}`
      return <article key={group.id} className="min-w-0 overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: color + '55', borderLeftWidth: 5, borderLeftColor: color }} data-attendance-leader={group.id}>
        <h3><button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenGroups(current => ({ ...current, [group.id]: !open }))} className="flex w-full items-start gap-3 p-4 text-left hover:bg-[#f5f8f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3e712c] sm:items-center sm:p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: color }}><GitBranch className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1"><span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">{group.kind === 'leader' ? 'Líder / jefe' : 'Grupo de seguimiento'}</span><span className="mt-1 block break-words text-base font-semibold">{group.name}</span><span className="mt-1 block text-xs text-slate-500">{group.people.length} {group.people.length === 1 ? 'colaborador' : 'colaboradores'} · {periodCaption(shownPeriod)}</span><span className="mt-3 block"><StatusCounts days={group.days} preview={preview} /></span></span>
          <ChevronDown className={`mt-2 h-5 w-5 shrink-0 text-[#3e712c] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button></h3>
        <div id={panelId} hidden={!open}>{open && <div className="relative space-y-3 border-t p-3 pl-10 sm:p-5 sm:pl-14" style={{ backgroundColor: color + '08', borderColor: color + '33' }}><span aria-hidden="true" className="absolute bottom-8 left-5 top-0 border-l-2 sm:left-7" style={{ borderColor: color + '88' }} />{group.kind !== 'leader' && <p className="text-xs leading-relaxed text-slate-500">{group.kind === 'notApplicable' ? 'Sus checadas se conservan; no requieren justificación ni acumulan incidencias.' : 'Estos registros no tienen un responsable de dictamen asignado.'}</p>}{group.people.map(person => <div className="relative" key={person.userId}><span aria-hidden="true" className="absolute -left-5 top-7 w-5 border-t-2 sm:-left-7 sm:w-7" style={{ borderColor: color + '88' }} /><EmployeeIncidences key={`${person.userId}-${search}-${state}-${onlyIssues}-${category}`} person={person} preview={preview} period={shownPeriod} /></div>)}</div>}</div>
      </article>
    })}
  </section>
}
