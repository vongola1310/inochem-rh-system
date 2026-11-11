import { addDateDays, dateKey, datesBetween, isWorkday, timeSeconds } from './dates'
import type { CoverageRequest, Employee, Evaluation, ImportConfiguration, Leave, Preview, Punch, SourceFile, FieldWorkEvidence } from './types'
import { isReviewNotApplicable, REVIEWER_NOT_APPLICABLE, requiresReview } from './review-policy'
import { resolveWorkday, type ReducedSchedule, type Workday } from './workday'
import { attendanceSites } from './site'
import { workedTime, durationLabel } from './field-hours'

const FULL_DAY = new Map([
  ['VACATION', 'Vacaciones'], ['PERMIT_ABSENCE', 'Permiso de ausencia'],
  ['PERMIT_BIRTHDAY', 'Permiso de cumpleaños'], ['PERMIT_HOME_OFFICE', 'Home Office'],
])

export function signedByBoss(request: CoverageRequest): boolean {
  return request.approvedByBoss && ['APPROVED', 'PENDING_HR', 'CANCELLATION_REQUESTED'].includes(request.status)
}

export function requestCoversDate(request: CoverageRequest, date: string): boolean {
  if (!signedByBoss(request) || date < dateKey(request.startDate)) return false
  if (request.type === 'VACATION') return !!request.returnDate && date < dateKey(request.returnDate)
  return date <= (request.endDate ? dateKey(request.endDate) : dateKey(request.startDate))
}

export function evaluateDay(userId: string, date: string, punches: Punch[], requests: CoverageRequest[], leaves: Leave[], managerId: string | null, workday: Workday = resolveWorkday(date)): Evaluation {
  const EXIT = workday.endSeconds, LATE_FROM = workday.startSeconds + 11 * 60
  const times = [...new Set(punches.map(p => p.seconds))].sort((a, b) => a - b)
  let entrySeconds: number | null = times[0] ?? null
  let exitSeconds = times.length > 1 ? times[times.length - 1] : null
  let exitEstimated = false
  const systemNotes: string[] = [], detectedIssues: string[] = [], coverage: string[] = []
  const applicable = requests.filter(r => r.userId === userId && requestCoversDate(r, date))
  const medical = leaves.filter(l => l.userId === userId && !l.cancelledAt && dateKey(l.startDate) <= date && dateKey(l.endDate) >= date)
  if (times.length === 1 && times[0] >= EXIT) {
    entrySeconds = null; exitSeconds = times[0]
    systemNotes.push('Este día no checó entrada; solo hay una marcación al terminar la jornada.')
  } else if (entrySeconds !== null && exitSeconds === null) {
    systemNotes.push('Este día no checó salida. Se conserva únicamente la entrada registrada.')
  }
  if (!times.length) systemNotes.push('Este día no checó: registro sin entrada ni salida.')
  if (workday.ruleIds.length) systemNotes.push('Jornada reducida aplicada: ' + Math.floor(workday.startSeconds / 3600).toString().padStart(2, '0') + ':' + Math.floor(workday.startSeconds % 3600 / 60).toString().padStart(2, '0') + '–' + Math.floor(workday.endSeconds / 3600).toString().padStart(2, '0') + ':' + Math.floor(workday.endSeconds % 3600 / 60).toString().padStart(2, '0') + '.')
  for (const request of applicable) {
    const label = FULL_DAY.get(request.type)
    if (label) coverage.push(label)
    else if (request.type === 'PERMIT_LATE') coverage.push('Permiso para llegar tarde')
    else if (request.type === 'PERMIT_EARLY') coverage.push('Permiso para salir temprano')
    else coverage.push('Permiso especial: requiere dictamen de alcance')
  }
  if (medical.length) coverage.push('Incapacidad')
  const fullDay = medical.length > 0 || applicable.some(r => FULL_DAY.has(r.type))
  let lateMinutes = entrySeconds !== null && entrySeconds >= LATE_FROM ? Math.ceil((entrySeconds - workday.startSeconds) / 60) : 0
  if (!fullDay) {
    if (!times.length) detectedIssues.push('ABSENCE')
    else if (entrySeconds === null) detectedIssues.push('MISSING_ENTRY')
    else if (entrySeconds >= LATE_FROM) {
      const permissions = applicable.filter(r => r.type === 'PERMIT_LATE')
      const limits = permissions.map(r => timeSeconds(r.permitTime || ''))
      if (!limits.some(limit => limit !== null && entrySeconds! <= limit)) detectedIssues.push('LATE')
      if (limits.includes(null)) detectedIssues.push('PERMISSION_REVIEW')
    }
    if (exitSeconds !== null && exitSeconds < EXIT) {
      const permissions = applicable.filter(r => r.type === 'PERMIT_EARLY')
      const limits = permissions.map(r => timeSeconds(r.permitTime || ''))
      if (!limits.some(limit => limit !== null && exitSeconds! >= limit)) detectedIssues.push('EARLY_EXIT')
      if (limits.includes(null)) detectedIssues.push('PERMISSION_REVIEW')
    }
    if (times.length && exitSeconds === null) detectedIssues.push('MISSING_EXIT')
    if (applicable.some(r => r.type === 'PERMIT_OTHER')) detectedIssues.push('PERMISSION_REVIEW')
  }
  if (fullDay) lateMinutes = 0
  if (medical.length + applicable.filter(r => FULL_DAY.has(r.type)).length > 1) systemNotes.push('Hay más de una autorización que cubre esta fecha.')
  return { userId, date, managerId, entrySeconds, exitSeconds, exitEstimated, lateMinutes,
    detectedIssues: [...new Set(detectedIssues)], coverage: [...new Set(coverage)], systemNotes,
    evidence: { punches, requestIds: applicable.map(r => r.id).sort(), leaveIds: medical.map(l => l.id).sort(), workday } }
}

export function buildPreview(input: { start: string; end: string; sources: SourceFile[]; employees: Employee[]; requests: CoverageRequest[]; leaves: Leave[]; holidays: string[]; config: ImportConfiguration; fieldWork?: FieldWorkEvidence[]; fieldErrors?: string[]; fieldWarnings?: string[]; fieldReferences?: Preview['fieldReferences']; schedules?: ReducedSchedule[] }): Preview {
  const { start, end, sources, employees, config } = input
  const siteFor = attendanceSites(sources, employees, config)
  const dates = datesBetween(start, end), errors: string[] = [...(input.fieldErrors || [])], warnings = [...sources.flatMap(source => source.warnings), ...(input.fieldWarnings || [])]
  const byNumber = new Map(employees.map(employee => [employee.employeeNumber, employee]))
  const byId = new Map(employees.map(employee => [employee.id, employee]))
  const included = new Set(config.includedUserIds.filter(id => !byId.get(id)?.isBlacklisted))
  if (!config.includedUserIds.length) errors.push('Selecciona al menos un colaborador para el periodo.')
  for (const id of included) if (!byId.has(id)) errors.push('Un colaborador seleccionado ya no existe.')
  for (const employee of employees.filter(e => !e.isBlacklisted)) {
    if (!included.has(employee.id) && !config.excludedUsers[employee.id]?.trim()) errors.push(`Indica por qué se excluye a ${employee.name} del padrón.`)
  }
  const identities: Preview['identities'] = []
  const assignments = new Map<string, string>()
  for (const source of sources) for (const person of source.people) {
    const key = `${source.site}:${person.externalId}`
    const explicit = config.mappings[key]
    const blacklisted = byNumber.get(person.externalId)?.isBlacklisted || (explicit?.userId && byId.get(explicit.userId)?.isBlacklisted)
    if (blacklisted) {
      identities.push({ key, site: source.site, externalId: person.externalId, name: person.name, userId: byNumber.get(person.externalId)?.id || explicit?.userId || null, excluded: true })
      continue
    }
    const userId = explicit ? explicit.userId : byNumber.get(person.externalId)?.id || null
    const excluded = !!explicit && !explicit.userId && !!explicit.reason.trim()
    identities.push({ key, site: source.site, externalId: person.externalId, name: person.name, userId, excluded })
    if (!userId && !excluded) errors.push(`Vincula o excluye con motivo el ID ${person.externalId} de ${source.site}.`)
    if (explicit && !explicit.reason.trim()) errors.push(`Indica el motivo de la vinculación o exclusión del ID ${person.externalId}.`)
    if (userId && !byId.has(userId)) errors.push(`El ID ${person.externalId} está vinculado a un usuario inexistente.`)
    if (userId) assignments.set(key, userId)
  }
  const grouped = new Map<string, Punch[]>()
  for (const source of sources) for (const punch of source.punches) {
    const userId = assignments.get(`${source.site}:${punch.externalId}`)
    if (!userId || !included.has(userId)) continue
    const key = `${userId}|${punch.date}`
    const group = grouped.get(key) || []
    group.push(punch); grouped.set(key, group)
  }
  const days: Evaluation[] = [], holidays = new Set(input.holidays)
  for (const employee of employees.filter(e => included.has(e.id))) {
    const notApplicable = config.reviewers[employee.id] === REVIEWER_NOT_APPLICABLE
    const managerId = notApplicable ? null : config.reviewers[employee.id] || employee.bossId
    if (managerId && (!byId.has(managerId) || byId.get(managerId)?.isBlacklisted || managerId === employee.id)) errors.push(`Selecciona otro responsable de dictamen para ${employee.name}.`)
    for (const date of dates) {
      if (date < dateKey(employee.entryDate) || !isWorkday(date, holidays)) continue
      const workday = resolveWorkday(date, siteFor(employee.id, date), input.schedules)
      if (workday.ambiguous && !notApplicable) errors.push(`Selecciona la sede de ${employee.name} en el padrón para aplicar su jornada del ${date}.`)
      const row = evaluateDay(employee.id, date, grouped.get(`${employee.id}|${date}`) || [], input.requests, input.leaves, managerId, workday)
      const fieldWork = (input.fieldWork || []).filter(day => day.userId === employee.id && day.date === date)
      if (fieldWork.length) {
        row.coverage.push('Trabajo de campo (Salesforce)')
        row.evidence.fieldWork = fieldWork
        const summary = workedTime(fieldWork, row.evidence.punches, workday)
        row.evidence.workSummary = summary
        const authorized = row.coverage.includes('Incapacidad') || [...FULL_DAY.values()].some(label => row.coverage.includes(label))
        row.systemNotes.push('Trabajo registrado: ' + durationLabel(summary.fieldSeconds) + ' en campo + ' + durationLabel(summary.officeSeconds) + ' en oficina, sin superponer los servicios con las checadas.')
        if (!authorized) {
          if (summary.fieldConflict || (summary.uncertainOffice && summary.fieldSeconds < 21600)) {
            row.detectedIssues.push('FIELD_DATA_REVIEW')
            row.systemNotes.push('Hay servicios superpuestos, referencias contradictorias o checadas sin pareja; el jefe debe revisar los tramos antes de aceptar las horas.')
          } else if (summary.workedSeconds >= 21600) {
            row.detectedIssues = row.detectedIssues.filter(issue => !['ABSENCE', 'MISSING_ENTRY', 'MISSING_EXIT', 'LATE', 'EARLY_EXIT'].includes(issue))
            row.lateMinutes = 0
            row.systemNotes.push('Cumple 6 horas o más de trabajo combinado. Sin incidencia de asistencia.')
          } else {
            if (summary.workedSeconds > 0) row.detectedIssues = row.detectedIssues.filter(issue => issue !== 'ABSENCE')
            row.detectedIssues.push('FIELD_INSUFFICIENT_HOURS')
          }
        }

      }
      if (notApplicable) {
        row.evidence.reviewNotApplicable = true
        row.systemNotes.push('N/A — No aplica dictamen. Se conservan las checadas; no genera justificaciones ni acumulación de retardos o faltas.')
      }
      if (requiresReview(row) && !managerId) errors.push(`Asigna un responsable de dictamen a ${employee.name}.`)
      days.push(row)
    }
  }
  const nonWorkingPunches = sources.flatMap(s => s.punches).filter(p => !isWorkday(p.date, holidays)).length
  if (nonWorkingPunches) warnings.push(`${nonWorkingPunches} marcaciones corresponden a fines de semana o festivos y se conservan en la fuente sin generar incidencias.`)
  return { period: { start, end, businessDays: dates.filter(date => isWorkday(date, holidays)).length }, days: days.sort((a, b) => a.date.localeCompare(b.date) || a.userId.localeCompare(b.userId)), errors: [...new Set(errors)], warnings: [...new Set(warnings)], identities, ...(input.fieldReferences?.length ? { fieldReferences: input.fieldReferences } : {}) }
}

export function monthlyTotals(rows: { userId: string; date: Date | string; decision: string; reviewStatus: string; needsRefresh?: boolean; evidence?: unknown }[]) {
  const groups = new Map<string, { userId: string; month: string; late: number; absences: number; incidents: number; earlyExits: number; justified: number; pending: number; days: number; notApplicable: number }>()
  const seen = new Set<string>()
  for (const row of rows) {
    const day = `${row.userId}|${dateKey(row.date)}`
    if (seen.has(day)) throw new Error('Hay un empleado/fecha duplicado en el acumulado mensual.')
    seen.add(day)
    const month = dateKey(row.date).slice(0, 7), key = `${row.userId}|${month}`
    const total = groups.get(key) || { userId: row.userId, month, late: 0, absences: 0, incidents: 0, earlyExits: 0, justified: 0, pending: 0, days: 0, notApplicable: 0 }
    total.days++
    if (isReviewNotApplicable(row.evidence)) total.notApplicable++
    else if (row.reviewStatus !== 'RESOLVED' || row.needsRefresh) total.pending++
    else {
      if (['LATE', 'LATE_EARLY_EXIT'].includes(row.decision)) total.late++
      if (['EARLY_EXIT', 'LATE_EARLY_EXIT'].includes(row.decision)) total.earlyExits++
      if (row.decision === 'ABSENCE') total.absences++
      if (row.decision === 'INCIDENT') total.incidents++
      if (row.decision === 'JUSTIFIED') total.justified++
    }
    groups.set(key, total)
  }
  return [...groups.values()]
}

export function periodTotals(rows: Parameters<typeof monthlyTotals>[0], start: string, end: string) {
  const groups = new Map<string, Omit<ReturnType<typeof monthlyTotals>[number], 'month'> & { start: string; end: string }>()
  for (const { month, ...row } of monthlyTotals(rows)) {
    const before = groups.get(row.userId)
    if (!before) groups.set(row.userId, { ...row, start, end })
    else for (const key of ['days', 'late', 'absences', 'incidents', 'earlyExits', 'justified', 'pending', 'notApplicable'] as const) before[key] += row[key]
  }
  return [...groups.values()]
}
