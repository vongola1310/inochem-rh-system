import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { fieldReportActor } from '@/lib/field-reports/access'
import { displayDate } from '@/lib/attendance/dates'
import { AttendanceShell } from '@/components/attendance/shell'
import { DeleteFieldReportButton } from '@/components/field-reports/delete-button'
import { FieldReportPanel } from '@/components/field-reports/report-panel'
import type { FieldMapping, FieldSource } from '@/lib/field-reports/types'

export default async function FieldReportPage({ params }: { params: { id: string } }) {
  const actor = await fieldReportActor().catch(() => null)
  if (!actor) redirect('/')
  const report = await prisma.fieldReport.findUnique({ where: { id: params.id } })
  if (!report || (report.managerId !== actor.id && !['HR', 'ADMIN'].includes(actor.role))) notFound()
  const employees = await prisma.user.findMany({ select: { id: true, name: true, employeeNumber: true, entryDate: true, isBlacklisted: true }, orderBy: { name: 'asc' } })
  const { originalFileBase64, ...source } = report.source as unknown as FieldSource
  return <AttendanceShell role={actor.role} title={'Referencia de campo · ' + displayDate(report.startDate) + ' — ' + displayDate(report.endDate)} description="El archivo queda guardado para cruzarlo con las checadas cuando RH importe o actualice el periodo de biochecadores.">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 text-sm"><p className="break-words">{source.fileName} · {report.status === 'DRAFT' ? 'Borrador anterior' : report.status === 'CONFIRMED' ? 'Referencia guardada' : 'Cancelado'}</p>{originalFileBase64 && <a className="font-semibold text-green-800 underline" href={'/api/field-reports/' + report.id + '/download'}>Descargar archivo original</a>}<DeleteFieldReportButton id={report.id} version={report.version} label={displayDate(report.startDate) + ' — ' + displayDate(report.endDate)} /></div>
    <FieldReportPanel key={report.version} id={report.id} version={report.version} status={report.status} editable={report.managerId === actor.id} source={source} mappings={report.mappings as unknown as FieldMapping} employees={employees.map(employee => ({ ...employee, entryDate: employee.entryDate.toISOString() }))} />
  </AttendanceShell>
}

