'use client'

import { useMemo } from 'react'
import type { Evaluation } from '@/lib/attendance/types'
import { initialReviewState, isReviewNotApplicable } from '@/lib/attendance/review-policy'
import { AttendanceLeaderList } from './leader-list'

export function AttendancePreviewTable({ days, employees, period }: { days: Evaluation[]; employees: { id: string; name: string; employeeNumber: string }[]; period?: { start: string; end: string; businessDays: number } }) {
  const people = useMemo(() => new Map(employees.map(employee => [employee.id, employee])), [employees])
  const displayDays = useMemo(() => days.map(day => ({
    ...day, id: day.userId + '-' + day.date,
    user: people.get(day.userId) || { name: 'Colaborador', employeeNumber: '' },
    manager: day.managerId ? people.get(day.managerId) || { name: 'Responsable del dictamen' } : null,
    ...initialReviewState(day),
    justification: null, managerComment: null, fieldWork: day.evidence.fieldWork || [], workSummary: day.evidence.workSummary,
    reviewNotApplicable: isReviewNotApplicable(day.evidence), punches: day.evidence.punches,
  })), [days, people])
  return <AttendanceLeaderList days={displayDays} preview period={period} />
}
