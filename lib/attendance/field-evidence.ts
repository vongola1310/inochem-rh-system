import type { FieldWorkEvidence } from './types'

export function getFieldWork(evidence: unknown): FieldWorkEvidence[] {
  if (!evidence || typeof evidence !== 'object' || !('fieldWork' in evidence) || !Array.isArray(evidence.fieldWork)) return []
  return evidence.fieldWork.filter((item): item is FieldWorkEvidence => !!item && typeof item === 'object' && typeof item.reportId === 'string' && Array.isArray(item.appointments))
}

export function getWorkSummary(evidence: unknown): import('./field-hours').WorkSummary | undefined {
  if (!evidence || typeof evidence !== 'object' || !('workSummary' in evidence)) return undefined
  const summary = evidence.workSummary as import('./field-hours').WorkSummary | undefined
  return summary && typeof summary.workedSeconds === 'number' && Array.isArray(summary.officeIntervals) ? summary : undefined
}
