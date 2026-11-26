'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { attendanceTransaction } from '@/lib/attendance/service'
import { markAttendanceStale } from '@/lib/attendance/staleness'
import { remoteClockTime, remotePunchSelect, validateClockPhoto } from '@/lib/remote-clock'
import { attendanceActor } from '@/lib/attendance/access'
import { addDateDays, dateKey, parseDate, todayInMexico } from '@/lib/attendance/dates'
import type { Prisma } from '@prisma/client'

export async function getDirectRemoteAttendance(input: { team: boolean; date: string; search?: string; page?: number }) {
  const actor = await attendanceActor()
  const date = parseDate(input.date)
  const today = todayInMexico()
  if (input.date > today) throw new Error('Selecciona hoy o una fecha anterior.')
  const page = Number.isSafeInteger(input.page) ? Math.max(1, Math.min(10000, input.page!)) : 1
  const search = String(input.search || '').trim().slice(0, 100)
  // Alcance determinado por la cuenta autenticada: nunca por un líder enviado por el navegador.
  const where: Prisma.UserWhereInput = {
    isBlacklisted: false,
    entryDate: { lt: parseDate(addDateDays(input.date, 1)) },
    ...(input.team ? { bossId: actor.id, id: { not: actor.id } } : { id: actor.id }),
    AND: [
      { OR: [{ isRemote: true }, { remotePunches: { some: { date } } }] },
      ...(search ? [{ OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { employeeNumber: { contains: search, mode: 'insensitive' as const } }] }] : []),
    ],
  }
  const pageSize = 10
  const count = await prisma.user.count({ where })
  const pages = Math.max(1, Math.ceil(count / pageSize)), currentPage = Math.min(page, pages)
  const people = await prisma.user.findMany({ where, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: pageSize, skip: (currentPage - 1) * pageSize,
    select: { id: true, name: true, employeeNumber: true, remotePunches: { where: { date }, select: remotePunchSelect, orderBy: { recordedAt: 'asc' } } },
  })
  return { date: dateKey(date), today, count, page: currentPage, pages, updatedAt: new Date().toISOString(), people: people.map(person => ({ ...person,
    remotePunches: person.remotePunches.map(punch => ({ ...punch, date: dateKey(punch.date), recordedAt: punch.recordedAt.toISOString() })),
  })) }
}

export async function getRemoteClockStatus() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Inicia sesión para checar.')
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isRemote: true, isBlacklisted: true } })
  if (!user?.isRemote || user.isBlacklisted) throw new Error('Tu cuenta no tiene habilitado el checador remoto.')
  const now = remoteClockTime()
  const punches = await prisma.remotePunch.findMany({ where: { userId: session.user.id, date: now.date }, select: remotePunchSelect, orderBy: { recordedAt: 'asc' } })
  return { date: now.date.toISOString().slice(0, 10), serverTime: now.recordedAt.toISOString(), punches }
}

export async function recordRemotePunch(form: FormData) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, message: 'Inicia sesión para checar.' }
    const userId = session.user.id
    const kind = String(form.get('kind') || '')
    if (!['ENTRY', 'EXIT'].includes(kind)) return { success: false, message: 'Selecciona entrada o salida.' }
    const photo = form.get('photo') as File | null
    if (!photo || typeof photo.arrayBuffer !== 'function' || photo.size > 500_000) return { success: false, message: 'Toma una foto con la cámara para registrar tu checada.' }
    const bytes = Buffer.from(await photo.arrayBuffer())
    try { validateClockPhoto(bytes) } catch { return { success: false, message: 'La foto no es válida. Vuelve a tomarla con la cámara.' } }
    const now = remoteClockTime()
    if (form.get('date') !== now.date.toISOString().slice(0, 10)) return { success: false, message: 'Cambió el día. Cierra y vuelve a abrir el checador.' }
    const result = await attendanceTransaction(async tx => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { isRemote: true, isBlacklisted: true } })
      if (!user?.isRemote || user.isBlacklisted) return { success: false, message: 'Tu cuenta no tiene habilitado el checador remoto.' }
      const existing = await tx.remotePunch.findUnique({ where: { userId_date_kind: { userId, date: now.date, kind } }, select: remotePunchSelect })
      if (existing) return { success: true, message: 'Esta checada ya estaba registrada. Conservamos su foto y hora originales.' }
      // Una salida sin entrada se guarda: debe generar la incidencia correspondiente.
      const exit = kind === 'ENTRY' && await tx.remotePunch.findUnique({ where: { userId_date_kind: { userId, date: now.date, kind: 'EXIT' } }, select: { id: true } })
      if (exit) return { success: false, message: 'Ya registraste la salida de hoy. Solicita a tu jefe revisar la entrada faltante.' }
      const punch = await tx.remotePunch.create({ data: { userId, kind, ...now, photo: bytes }, select: { id: true } })
      await markAttendanceStale(tx, now.date, now.date, userId)
      await tx.attendanceEvent.create({ data: { actorId: userId, action: 'REMOTE_PUNCH_RECORDED', details: { punchId: punch.id, kind, recordedAt: now.recordedAt.toISOString() } } })
      return { success: true, message: `${kind === 'ENTRY' ? 'Entrada' : 'Salida'} registrada con foto y hora del servidor.` }
    })
    revalidatePath('/'); revalidatePath('/attendance'); revalidatePath('/admin/attendance', 'layout')
    return result
  } catch {
    return { success: false, message: 'No se pudo confirmar la checada. Revisa tu conexión y consulta el registro de hoy antes de reintentar.' }
  }
}
