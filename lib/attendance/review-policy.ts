export const REVIEWER_NOT_APPLICABLE = '__NOT_APPLICABLE__'
export const NOT_APPLICABLE_LABEL = 'N/A — No aplica'

export function isReviewNotApplicable(evidence: unknown): boolean {
  return !!evidence && typeof evidence === 'object' && !Array.isArray(evidence)
    && (evidence as { reviewNotApplicable?: unknown }).reviewNotApplicable === true
}

type ReviewableDay = { detectedIssues: string[]; coverage: string[]; evidence: unknown }
export function requiresReview(day: ReviewableDay): boolean {
  return !isReviewNotApplicable(day.evidence) && day.detectedIssues.length > 0
}

export function initialReviewState(day: ReviewableDay) {
  if (requiresReview(day)) return { reviewStatus: 'WAITING_MANAGER' as const, decision: 'PENDING' as const }
  return { reviewStatus: 'RESOLVED' as const, decision: !isReviewNotApplicable(day.evidence) && day.coverage.length ? 'JUSTIFIED' as const : 'NONE' as const }
}
