import { attendanceTransaction } from '@/lib/attendance/service'
import { addDateDays, dateKey, parseDate, todayInMexico } from '@/lib/attendance/dates'

// Un aviso por vencimiento, incluso con varias pestañas consultando la campana.
export async function ensureFieldReportReminder(userId: string, today = todayInMexico()) {
  return attendanceTransaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { canUploadFieldReports: true, isBlacklisted: true } })
    if (!user?.canUploadFieldReports || user.isBlacklisted) return false
    const schedule = await tx.fieldReportSchedule.upsert({ where: { userId }, create: { userId, nextDueDate: parseDate(today) }, update: {} })
    if (dateKey(schedule.nextDueDate) > today) return false
    const overdueDays = Math.floor((parseDate(today).getTime() - schedule.nextDueDate.getTime()) / 86400000)
    const reminderDate = addDateDays(dateKey(schedule.nextDueDate), Math.floor(overdueDays / 14) * 14)
    if (schedule.lastReminderDate && dateKey(schedule.lastReminderDate) >= reminderDate) return false
    const updated = await tx.fieldReportSchedule.updateMany({ where: { userId, nextDueDate: schedule.nextDueDate, lastReminderDate: schedule.lastReminderDate }, data: { lastReminderDate: parseDate(reminderDate) } })
    if (updated.count !== 1) return false
    await tx.notification.create({ data: { userId, title: 'Subir reporte de personal de campo',
      message: `Está pendiente el reporte de Salesforce correspondiente al recordatorio del ${dateKey(schedule.nextDueDate)}. Guarda el archivo de referencia para programar el siguiente aviso dentro de 14 días.`, link: '/field-reports' } })
    return true
  })
}
