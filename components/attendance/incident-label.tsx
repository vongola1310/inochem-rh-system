import { CheckCircle2, Clock3, TriangleAlert } from 'lucide-react'
import { DECISION_LABELS, ISSUE_LABELS } from '@/lib/attendance/types'

type IncidentDay = { detectedIssues: string[]; reviewStatus: string; decision: string; reviewNotApplicable?: boolean }

export function attendanceTone(day: IncidentDay): 'absence' | 'late' | 'clear' | 'incident' | 'neutral' {
  if (day.reviewNotApplicable) return 'neutral'
  if (day.reviewStatus === 'RESOLVED') {
    if (day.decision === 'ABSENCE') return 'absence'
    if (['LATE', 'LATE_EARLY_EXIT'].includes(day.decision)) return 'late'
    if (['NONE', 'JUSTIFIED'].includes(day.decision)) return 'clear'
    if (day.decision === 'INCIDENT') return 'incident'
    return 'neutral'
  }
  if (day.detectedIssues.includes('ABSENCE')) return 'absence'
  if (day.detectedIssues.includes('LATE')) return 'late'
  return day.detectedIssues.length ? 'incident' : 'clear'
}

export const hasHighlightedAbsence = (day: IncidentDay) => attendanceTone(day) === 'absence'
export const hasHighlightedLate = (day: IncidentDay) => attendanceTone(day) === 'late'
export const hasNoActiveIncident = (day: IncidentDay) => attendanceTone(day) === 'clear'
export function attendanceCardColors(day: IncidentDay) {
  return {
    absence: 'border-red-300 border-l-4 border-l-red-600 bg-red-50/50',
    late: 'border-orange-300 border-l-4 border-l-orange-600 bg-orange-50/50',
    clear: 'border-green-300 border-l-4 border-l-green-600 bg-green-50/50',
    incident: 'border-violet-300 border-l-4 border-l-violet-600 bg-violet-50/50',
    neutral: 'border-slate-200 bg-white',
  }[attendanceTone(day)]
}

export function AbsenceBadge({ children = 'Falta' }: { children?: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-md bg-red-700 px-2.5 py-1.5 text-xs font-bold text-white"><TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />{children}</span>
}

export function LateBadge({ children = 'Retardo' }: { children?: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-700 px-2.5 py-1.5 text-xs font-bold text-white"><Clock3 aria-hidden="true" className="h-4 w-4 shrink-0" />{children}</span>
}

export function ClearBadge({ children = 'Sin incidencia' }: { children?: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-2.5 py-1.5 text-xs font-bold text-white"><CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />{children}</span>
}

export function AttendanceDecisionBadge({ day }: { day: IncidentDay }) {
  const label = DECISION_LABELS[day.decision] || day.decision
  switch (attendanceTone(day)) {
    case 'absence': return <AbsenceBadge>Falta confirmada</AbsenceBadge>
    case 'late': return <LateBadge>{label}</LateBadge>
    case 'clear': return <ClearBadge>{label}</ClearBadge>
    case 'incident': return <span className="rounded-md bg-violet-700 px-2.5 py-1.5 text-xs font-bold text-white">{label}</span>
    default: return <span>{label}</span>
  }
}

export function AttendanceIssueLabels({ day }: { day: IncidentDay }) {
  const tone = attendanceTone(day)
  if (tone === 'clear') return <ClearBadge>{day.decision === 'JUSTIFIED' ? 'Justificada' : 'Sin incidencia'}</ClearBadge>
  if (!day.detectedIssues.length) return <span className="text-sm">Sin incidencia detectada</span>
  return <span className="flex flex-wrap items-center gap-2 text-sm">{day.detectedIssues.map(issue => issue === 'ABSENCE' && tone === 'absence'
    ? <AbsenceBadge key={issue} />
    : issue === 'LATE' && tone === 'late' ? <LateBadge key={issue} />
      : <span key={issue} className="rounded-md bg-violet-700 px-2.5 py-1.5 text-xs font-bold text-white">{ISSUE_LABELS[issue] || issue}</span>)}</span>
}
