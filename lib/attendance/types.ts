export type Site = 'AJUSCO' | 'PERIFERICO'
export type Punch = { externalId: string; name: string; date: string; seconds: number; row: number; site: Site }
export type SourceFile = { site: Site; name: string; digest: string; rowCount: number; duplicateCount: number; people: { externalId: string; name: string }[]; punches: Punch[]; warnings: string[] }
export type Employee = { id: string; employeeNumber: string; name: string; entryDate: Date | string; bossId: string | null; isBlacklisted?: boolean }
export type CoverageRequest = { id: string; userId: string; type: string; status: string; approvedByBoss: boolean; startDate: Date | string; returnDate: Date | string | null; endDate: Date | string | null; permitTime: string | null }
export type Leave = { id: string; userId: string; startDate: Date | string; endDate: Date | string; cancelledAt: Date | string | null }
export type FieldService = { appointment: string; account: string; workType: string; row: number; startSeconds: number; endSeconds: number; workedSeconds: number; reportedHours: number | null; method: 'REPORTED' | 'INTERVAL' }
export type FieldWorkEvidence = { reportId: string; userId: string; date: string; appointments: string[]; rows: number[]; entrySeconds: number | null; exitSeconds: number | null; services?: FieldService[] }
export type ImportConfiguration = {
  includedUserIds: string[]
  excludedUsers: Record<string, string>
  mappings: Record<string, { userId: string | null; reason: string }>
  reviewers: Record<string, string>
  sites?: Record<string, Site>
}
export type Evaluation = {
  userId: string; date: string; managerId: string | null
  entrySeconds: number | null; exitSeconds: number | null; exitEstimated: boolean; lateMinutes: number
  detectedIssues: string[]; coverage: string[]; systemNotes: string[]
  evidence: { punches: Punch[]; requestIds: string[]; leaveIds: string[]; reviewNotApplicable?: true; fieldWork?: FieldWorkEvidence[]; workday?: import('./workday').Workday; workSummary?: import('./field-hours').WorkSummary }
}
export type Preview = {
  period?: { start: string; end: string; businessDays: number }
  fieldReferences?: { id: string; fileName: string }[]
  days: Evaluation[]
  errors: string[]
  warnings: string[]
  identities: { key: string; site: Site; externalId: string; name: string; userId: string | null; excluded: boolean }[]
}
export const RULES_VERSION = '2026-10-29-v2'
export const ISSUE_LABELS: Record<string, string> = {
  ABSENCE: 'Falta', LATE: 'Retardo', EARLY_EXIT: 'Salida anticipada',
  MISSING_ENTRY: 'Sin registro de entrada', MISSING_EXIT: 'Sin registro de salida', PERMISSION_REVIEW: 'Revisar horario del permiso',
  FIELD_INSUFFICIENT_HOURS: 'Menos de 6 horas trabajadas', FIELD_DATA_REVIEW: 'Revisar horas de servicios',
}
export const DECISION_LABELS: Record<string, string> = {
  PENDING: 'Pendiente de dictamen', NONE: 'Sin incidencia', JUSTIFIED: 'Justificada', INCIDENT: 'Incidencia confirmada',
  LATE: 'Retardo', ABSENCE: 'Falta', EARLY_EXIT: 'Salida anticipada', LATE_EARLY_EXIT: 'Retardo y salida anticipada',
}
export const REVIEW_LABELS: Record<string, string> = {
  WAITING_EMPLOYEE: 'Revisión del jefe', WAITING_MANAGER: 'Revisión del jefe', RESOLVED: 'Resuelta',
}
export const LEAVE_LABELS = { MATERNAL: 'Maternal', GENERAL: 'General', WORK_RISK: 'Riesgo de trabajo' }
