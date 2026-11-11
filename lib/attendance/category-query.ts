import { Prisma } from '@prisma/client'
import { PERMIT_COVERAGE } from './categories'
const PERMITS = PERMIT_COVERAGE

// Mismos criterios antes de paginar en la vista del jefe y del colaborador.
export function attendanceCategoryWhere(category?: string): Prisma.AttendanceDayWhereInput {
  if (category === 'field') return { coverage: { has: 'Trabajo de campo (Salesforce)' } }
  if (category === 'permits') return { OR: [{ coverage: { hasSome: PERMITS } }, { detectedIssues: { has: 'PERMISSION_REVIEW' } }] }
  if (category === 'vacations') return { coverage: { has: 'Vacaciones' } }
  const issue = category === 'exits' ? 'EARLY_EXIT' : category === 'absences' ? 'ABSENCE' : category === 'late' ? 'LATE' : null
  if (!issue) return {}
  return { AND: [
    { OR: [{ evidence: { path: ['reviewNotApplicable'], equals: false } }, { evidence: { path: ['reviewNotApplicable'], equals: Prisma.AnyNull } }] },
    { OR: [
      { reviewStatus: { not: 'RESOLVED' }, detectedIssues: { has: issue } },
      { reviewStatus: 'RESOLVED', decision: { in: issue === 'ABSENCE' ? ['ABSENCE'] : [issue, 'LATE_EARLY_EXIT'] } },
    ] },
  ] }
}
