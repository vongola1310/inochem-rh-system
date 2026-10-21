import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { checkAndRenewBalance } from '@/lib/check-renewal'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'clave_secreta_default'}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  try {
    const employees = await prisma.user.findMany({
      where: { role: { not: 'HR' } }, select: { id: true },
    })
    let renewedCount = 0
    for (const employee of employees) {
      if (await checkAndRenewBalance(employee.id)) renewedCount++
    }
    return NextResponse.json({ success: true, message: `Se renovaron ${renewedCount} ciclos.` })
  } catch (error) {
    console.error('Error al renovar saldos:', error)
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}
