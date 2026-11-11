import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { fieldReportActor } from '@/lib/field-reports/access'
import type { FieldSource } from '@/lib/field-reports/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const actor = await fieldReportActor().catch(() => null)
  if (!actor) return new Response('Sin autorización.', { status: 403 })
  const report = await prisma.fieldReport.findUnique({ where: { id: params.id } })
  if (!report || (report.managerId !== actor.id && !['HR', 'ADMIN'].includes(actor.role))) return new Response('Archivo no disponible.', { status: 404 })
  const source = report.source as unknown as FieldSource
  if (!source.originalFileBase64) return new Response('Este reporte anterior conserva los datos interpretados, pero no el archivo original.', { status: 404 })
  const bytes = Buffer.from(source.originalFileBase64, 'base64')
  if (createHash('sha256').update(bytes).digest('hex') !== report.sourceDigest) return new Response('No se pudo verificar el archivo.', { status: 409 })
  const name = encodeURIComponent(source.fileName).replace(/['()*]/g, value => '%' + value.charCodeAt(0).toString(16).toUpperCase())
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': /\.xlsx$/i.test(source.fileName) ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.ms-excel',
    'Content-Disposition': "attachment; filename*=UTF-8''" + name,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } })
}
