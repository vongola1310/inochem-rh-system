import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) return new Response('No autorizado', { status: 401 })
  const actor = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isBlacklisted: true } })
  if (!actor || actor.isBlacklisted) return new Response('No autorizado', { status: 403 })
  const punch = await prisma.remotePunch.findUnique({ where: { id: params.id }, select: { userId: true, date: true, user: { select: { bossId: true } } } })
  if (!punch) return new Response('No encontrado', { status: 404 })
  const reviewer = await prisma.attendanceDay.findFirst({ where: { userId: punch.userId, date: punch.date, managerId: session.user.id }, select: { id: true } })
  if (punch.userId !== session.user.id && punch.user.bossId !== session.user.id && !reviewer && !['HR', 'ADMIN'].includes(actor.role)) return new Response('No autorizado', { status: 403 })
  const stored = await prisma.remotePunch.findUnique({ where: { id: params.id }, select: { photo: true } })
  if (!stored) return new Response('No encontrado', { status: 404 })
  return new Response(new Uint8Array(stored.photo), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline; filename="checada.jpg"' } })
}
