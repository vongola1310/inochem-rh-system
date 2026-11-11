import * as XLSX from 'xlsx'
import type { attendanceReport } from './report'
import type { SourceFile } from './types'
import { DECISION_LABELS, ISSUE_LABELS, REVIEW_LABELS } from './types'
import { getFieldWork, getWorkSummary } from './field-evidence'
import { dateKey, displayTime } from './dates'
import { isReviewNotApplicable, NOT_APPLICABLE_LABEL } from './review-policy'

export function buildAttendanceWorkbook(report: Awaited<ReturnType<typeof attendanceReport>>): Buffer {
  const workbook = XLSX.utils.book_new()
  const people = new Map(report.days.map(day => [day.userId, day.user]))
  const monthly = report.totals.map(total => ({
    'Periodo inicial': total.start,
    'Periodo final': total.end,
    'Número de empleado': people.get(total.userId)?.employeeNumber || '',
    'Colaborador': people.get(total.userId)?.name || '',
    'Días hábiles del colaborador': total.days,
    'Retardos confirmados': total.late,
    'Faltas confirmadas': total.absences,
    'Otras incidencias confirmadas': total.incidents,
    'Salidas anticipadas': total.earlyExits,
    'Días justificados': total.justified,
    'Días con respaldo de campo': total.fieldDays,
    'Días pendientes o por actualizar': total.pending,
    'Días N/A (sin proceso de incidencias)': total.notApplicable,
    'Alcance': 'Solo el periodo indicado; los retardos no se convierten en faltas.',
  }))
  const detail = report.days.map(day => ({
    'Número de empleado': day.user.employeeNumber, 'Colaborador': day.user.name,
    'Fecha': new Date(dateKey(day.date) + 'T00:00:00Z'),
    'Entrada': day.entrySeconds === null ? null : day.entrySeconds / 86400,
    'Salida': day.exitSeconds === null || day.exitEstimated ? null : day.exitSeconds / 86400,
    'Registro de checadas': day.entrySeconds === null && (day.exitSeconds === null || day.exitEstimated) ? 'Este día no checó: registro sin entrada ni salida' : day.entrySeconds === null ? 'Sin entrada' : day.exitSeconds === null || day.exitEstimated ? 'Sin salida' : 'Entrada y salida registradas',
    'Minutos de retardo desde el inicio de jornada': day.lateMinutes,
    'Evaluación inicial': day.detectedIssues.map(issue => ISSUE_LABELS[issue]).join(' · ') || 'Sin incidencia',
    'Autorizaciones aplicables': day.coverage.join(' · '),
    'Seguimiento': isReviewNotApplicable(day.evidence) ? NOT_APPLICABLE_LABEL : REVIEW_LABELS[day.reviewStatus], 'Dictamen': isReviewNotApplicable(day.evidence) ? NOT_APPLICABLE_LABEL : DECISION_LABELS[day.decision],
    'Justificación del colaborador': day.justification || '',
    'Responsable del dictamen': isReviewNotApplicable(day.evidence) ? NOT_APPLICABLE_LABEL : day.manager?.name || '', 'Comentario del responsable': day.managerComment || '',
    'Fecha de envío': day.submittedAt, 'Fecha de dictamen': day.reviewedAt,
    'Estado del periodo': report.batch.status === 'CLOSED' ? 'Cerrado' : 'Provisional',
    'Notas de evaluación': day.systemNotes.join(' · '),
    'Servicios Salesforce': getFieldWork(day.evidence).flatMap(row => row.appointments).join(' · '),
    'Horarios Salesforce (referencia)': getFieldWork(day.evidence).map(row => (row.entrySeconds === null ? 'Desde fecha anterior' : displayTime(row.entrySeconds)) + ' / ' + (row.exitSeconds === null ? 'Continúa en otra fecha' : displayTime(row.exitSeconds))).join(' · '),
    'Reportes de campo': getFieldWork(day.evidence).map(row => row.reportId).join(' · '),
    'Horas de campo': (getWorkSummary(day.evidence)?.fieldSeconds || 0) / 3600,
    'Horas en oficina sin superposición': (getWorkSummary(day.evidence)?.officeSeconds || 0) / 3600,
    'Horas combinadas': (getWorkSummary(day.evidence)?.workedSeconds || 0) / 3600,
    'Dónde estuvo (cuenta / lugar)': [...new Set(getFieldWork(day.evidence).flatMap(row => (row.services || []).map(service => service.account || 'Sin cuenta informada')))].join(' · '),
    'Tramos de oficina': (getWorkSummary(day.evidence)?.officeIntervals || []).map(interval => displayTime(interval.startSeconds) + '–' + displayTime(interval.endSeconds)).join(' · '),
  }))
  const sources = (report.batch.sources as unknown as SourceFile[]).map(source => ({
    'Sede': source.site, 'Archivo': source.name, 'SHA-256': source.digest,
    'Filas de origen': source.rowCount, 'Marcaciones únicas': source.punches.length,
    'Marcaciones repetidas excluidas': source.duplicateCount,
    'Periodo inicial': report.batch.startDate, 'Periodo final': report.batch.endDate,
    'Reglas': report.batch.rulesVersion,
    'Jornada': 'Lunes a viernes excepto festivos; 08:00–17:00 o jornada reducida por fecha y sede. Retardo desde el minuto 11.',
    'Autorizaciones': 'Firma del jefe válida aunque RH esté pendiente. Sin salida automática ni equivalencia de retardos. Campo más oficina: mínimo 6 horas sin solapamientos.',
  }))
  for (const [name, data] of [['Resumen del periodo', monthly], ['Detalle', detail], ['Fuentes', sources]] as const) {
    const sheet = XLSX.utils.json_to_sheet(data as Record<string, unknown>[], { cellDates: true, dateNF: 'dd/mm/yyyy' })
    const headers = Object.keys(data[0] || {})
    sheet['!cols'] = headers.map(header => ({ wch: /Colaborador|Comentario|Justificación|Notas|Alcance|Reglas|Archivo|Autorizaciones|Jornada/.test(header) ? 45 : /SHA/.test(header) ? 66 : 23 }))
    if (sheet['!ref']) sheet['!autofilter'] = { ref: sheet['!ref'] }
    for (let row = 1; row <= data.length; row++) for (let col = 0; col < headers.length; col++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })]
      if (!cell) continue
      if (headers[col] === 'Entrada' || headers[col] === 'Salida') cell.z = 'hh:mm:ss'
      // Los textos libres permanecen como texto; nunca se convierten en fórmulas.
      if (cell.t === 's') delete cell.f
    }
    XLSX.utils.book_append_sheet(workbook, sheet, name)
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true })
}
