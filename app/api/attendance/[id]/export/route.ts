import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { actionError, attendanceActor } from '@/lib/attendance/access'
import { attendanceReport } from '@/lib/attendance/report'
import { buildAttendanceWorkbook } from '@/lib/attendance/excel'
import { dateKey } from '@/lib/attendance/dates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const actor = await attendanceActor(['HR', 'ADMIN']).catch(() => null)
  if (!actor) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 })
  try {
    const report = await prisma.$transaction(tx => attendanceReport(tx, params.id), { isolationLevel: 'RepeatableRead', timeout: 30000 })
    if (report.stale) return NextResponse.json({ error: 'Actualiza las autorizaciones del periodo antes de descargar.' }, { status: 409 })
    const workbook = buildAttendanceWorkbook(report)
    return new NextResponse(new Uint8Array(workbook), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="incidencias-${dateKey(report.batch.startDate)}-${dateKey(report.batch.endDate)}.xlsx"`,
      'Cache-Control': 'private, no-store',
    } })
  } catch (error) { return NextResponse.json({ error: actionError(error) }, { status: 400 }) }
}
