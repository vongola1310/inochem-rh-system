export const ATTENDANCE_CATEGORIES: Record<string, string> = {
  all: 'Todos los tipos', permits: 'Permisos', exits: 'Salidas anticipadas', absences: 'Faltas', vacations: 'Vacaciones', late: 'Retardos', field: 'Trabajo de campo',
}
export const PERMIT_COVERAGE = ['Permiso de ausencia', 'Permiso de cumpleaños', 'Home Office', 'Permiso para llegar tarde', 'Permiso para salir temprano', 'Permiso especial: requiere dictamen de alcance']
type CategoryDay = { coverage: string[]; detectedIssues: string[]; decision: string; reviewStatus: string; reviewNotApplicable?: boolean }
export function matchesAttendanceCategory(day: CategoryDay, category = 'all') {
  if (category === 'field') return day.coverage.includes('Trabajo de campo (Salesforce)')
  if (category === 'permits') return day.coverage.some(label => PERMIT_COVERAGE.includes(label)) || day.detectedIssues.includes('PERMISSION_REVIEW')
  if (category === 'vacations') return day.coverage.includes('Vacaciones')
  const issue = category === 'exits' ? 'EARLY_EXIT' : category === 'absences' ? 'ABSENCE' : category === 'late' ? 'LATE' : null
  if (!issue) return true
  if (day.reviewNotApplicable) return false
  return day.reviewStatus === 'RESOLVED' ? day.decision === issue || (issue !== 'ABSENCE' && day.decision === 'LATE_EARLY_EXIT') : day.detectedIssues.includes(issue)
}
