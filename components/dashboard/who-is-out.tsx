import { PrismaClient } from '@prisma/client'
import { format, startOfDay, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { WhoIsOutTabs } from './who-is-out-client'

const prisma = new PrismaClient()

// Formatea la fecha en UTC para evitar desfase de timezone
// La BD guarda "2026-03-30T00:00:00Z", pero format() usa hora local
// y en México (UTC-6) lo muestra como 29 de marzo
function formatUTC(date: Date, fmt: string): string {
  const utc = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return format(utc, fmt, { locale: es })
}

export async function WhoIsOutCard() {
  const today = startOfDay(new Date())
  const nextTwoWeeks = addDays(today, 15)

  const requests = await prisma.request.findMany({
    where: {
      status: { in: ['APPROVED', 'PENDING_HR'] },
      type: 'VACATION',
      returnDate: { gte: today },
      startDate: { lte: nextTwoWeeks },
      user: {
        name: { not: 'Administrador' }
      }
    },
    include: {
      user: {
        select: { name: true, jobTitle: true }
      }
    },
    orderBy: { startDate: 'asc' },
    take: 12
  })

  const currentOut = requests.filter(req => {
    const start = startOfDay(new Date(req.startDate))
    if (req.returnDate) {
      const realReturn = addDays(startOfDay(new Date(req.returnDate)), -1)
      return today >= start && today <= realReturn
    }
    return false
  }).map(req => ({
    id: req.id,
    name: req.user.name,
    jobTitle: req.user.jobTitle || 'Empleado',
    initial: req.user.name.charAt(0).toUpperCase(),
    startDate: formatUTC(req.startDate, "d 'de' MMM yyyy"),
    returnDate: req.returnDate
      ? formatUTC(req.returnDate, "d 'de' MMM yyyy")
      : null,
    daysRequested: req.daysRequested,
  }))

  const upcomingOut = requests.filter(req => {
    const start = startOfDay(new Date(req.startDate))
    return start > today
  }).map(req => ({
    id: req.id,
    name: req.user.name,
    jobTitle: req.user.jobTitle || 'Empleado',
    initial: req.user.name.charAt(0).toUpperCase(),
    startDate: formatUTC(req.startDate, "d 'de' MMM yyyy"),
    returnDate: req.returnDate
      ? formatUTC(req.returnDate, "d 'de' MMM yyyy")
      : null,
    daysRequested: req.daysRequested,
  }))

  return <WhoIsOutTabs currentOut={currentOut} upcomingOut={upcomingOut} />
}