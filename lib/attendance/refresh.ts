import type { Prisma, AttendanceImport } from '@prisma/client'
import { asJson, digest, evaluateImport, notifyAttendanceManagers } from './service'
import { dateKey, parseDate } from './dates'
import { initialReviewState, REVIEWER_NOT_APPLICABLE } from './review-policy'
import { RULES_VERSION, type ImportConfiguration } from './types'
import { fail } from './access'

export async function refreshAttendanceEvaluation(tx: Prisma.TransactionClient, batch: AttendanceImport, actorId: string) {
  const id = batch.id
      const { preview, hash, employees } = await evaluateImport(tx, batch)
      const blacklisted = new Set(employees.filter(e => e.isBlacklisted).map(e => e.id))
      if (preview.errors.length) fail('No se puede actualizar: ' + preview.errors[0])
      const existing = await tx.attendanceDay.findMany({ where: { importId: id } })
      const changedUsers = new Set<string>()
      for (const before of existing.filter(row => row.isWorkday && !blacklisted.has(row.userId) && !preview.days.some(day => day.userId === row.userId && day.date === dateKey(row.date)))) {
        await tx.attendanceEvent.create({ data: { importId: id, dayId: before.id, actorId: actorId, action: 'DAY_REMOVED_FROM_CALENDAR', details: asJson({ before }) } })
        await tx.attendanceDay.update({ where: { id: before.id }, data: { isWorkday: false, reviewStatus: 'RESOLVED', decision: 'NONE', version: { increment: 1 } } })
        changedUsers.add(before.userId)
      }
      for (const day of preview.days) {
        const before = existing.find(row => row.userId === day.userId && dateKey(row.date) === day.date)
        if (!before) {
          const created = await tx.attendanceDay.create({ data: { ...day, date: parseDate(day.date), evidence: asJson(day.evidence), importId: id,
            ...initialReviewState(day) } })
          await tx.attendanceEvent.create({ data: { importId: id, dayId: created.id, actorId: actorId, action: 'DAY_ADDED_TO_CALENDAR', details: asJson(day) } })
          changedUsers.add(day.userId)
          continue
        }
        const previous = { ...day, entrySeconds: before.entrySeconds, exitSeconds: before.exitSeconds, exitEstimated: before.exitEstimated, lateMinutes: before.lateMinutes, detectedIssues: before.detectedIssues, coverage: before.coverage, systemNotes: before.systemNotes, evidence: before.evidence, managerId: before.managerId }
        if (before.isWorkday && digest(previous) === digest(day)) continue
        await tx.attendanceEvent.create({ data: { importId: id, dayId: before.id, actorId: actorId, action: 'EVIDENCE_UPDATED', details: asJson({ before: { detectedIssues: before.detectedIssues, coverage: before.coverage, decision: before.decision, justification: before.justification, managerComment: before.managerComment, reviewedById: before.reviewedById, reviewedAt: before.reviewedAt }, after: day }) } })
        await tx.attendanceDay.update({ where: { id: before.id }, data: { ...day, isWorkday: true, date: parseDate(day.date), evidence: asJson(day.evidence),
          ...initialReviewState(day),
          justification: null, submittedAt: null, managerComment: null, reviewedById: null, reviewedAt: null, version: { increment: 1 },
        } })
        changedUsers.add(day.userId)
      }
      await tx.attendanceImport.update({ where: { id }, data: { rulesVersion: RULES_VERSION, preview: asJson(preview), previewHash: hash, needsRefresh: false, status: changedUsers.size ? 'PUBLISHED' : batch.status, closedAt: changedUsers.size ? null : batch.closedAt, version: { increment: 1 } } })
      const notifyUsers = [...changedUsers].filter(userId => !blacklisted.has(userId) && (batch.configuration as unknown as ImportConfiguration).reviewers[userId] !== REVIEWER_NOT_APPLICABLE)
      if (notifyUsers.length) await tx.notification.createMany({ data: notifyUsers.map(userId => ({ userId, title: 'Asistencia actualizada', message: 'Cambió una autorización de tu periodo. Revisa el resultado actualizado y el dictamen de tu jefe.', link: `/attendance?period=${id}` })) })
      await notifyAttendanceManagers(tx, preview.days.filter(day => changedUsers.has(day.userId)), id)
      await tx.attendanceEvent.create({ data: { importId: id, actorId: actorId, action: 'REFRESHED', details: asJson({ previewHash: hash, changedUsers: [...changedUsers] }) } })
}
