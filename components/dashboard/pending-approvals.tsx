import Link from 'next/link'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { formatUTC } from '@/lib/format-date'
import { Button } from '@/components/ui/button'

export async function PendingApprovals({ managerId, totalRequests, requestedPage }: {
  managerId: string
  totalRequests: number
  requestedPage?: string | string[]
}) {
  const pageSize = 8
  const totalPages = Math.max(1, Math.ceil(totalRequests / pageSize))
  const pageNumber = Number(requestedPage)
  const currentPage = Number.isSafeInteger(pageNumber) && pageNumber > 0 ? Math.min(pageNumber, totalPages) : 1
  const offset = (currentPage - 1) * pageSize
  const requests = await prisma.request.findMany({
    where: { status: 'PENDING_BOSS', user: { bossId: managerId } },
    select: { id: true, type: true, startDate: true, daysRequested: true, user: { select: { name: true, jobTitle: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: offset, take: pageSize,
  })
  return <section aria-labelledby="approvals-title" className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
      <div><h2 id="approvals-title" className="font-semibold text-slate-900">Pendientes de tu aprobación</h2><p className="mt-1 text-xs text-slate-500">Las solicitudes más antiguas aparecen primero.</p></div>
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{totalRequests} pendientes</span>
    </div>
    {requests.length === 0 ? <div className="px-6 py-14 text-center"><CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-[#527346]" /><p className="font-medium">Todo al día</p><p className="mt-1 text-sm text-slate-500">No tienes solicitudes pendientes de aprobación.</p></div>
      : <ul className="divide-y divide-slate-100">{requests.map(request => <li key={request.id}>
        <Link href={`/dashboard/requests/${request.id}`} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3e712c] sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#edf4e9] text-sm font-semibold text-[#3e712c]">{request.user.name.charAt(0)}</span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{request.user.name}</p><p className="mt-0.5 text-xs text-slate-500">{request.user.jobTitle}</p><p className="mt-1 text-sm text-slate-600">{request.type === 'VACATION' ? 'Vacaciones' : 'Permiso'} · {formatUTC(request.startDate, 'd MMM yyyy')}{request.type === 'VACATION' && ` · ${request.daysRequested} ${request.daysRequested === 1 ? 'día' : 'días'}`}</p></div>
          <span className="hidden text-xs font-semibold text-[#3e712c] sm:inline">Revisar</span><ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        </Link>
      </li>)}</ul>}
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 sm:px-6">
      <Link href="/team/history" className="text-xs font-semibold text-[#3e712c] underline-offset-4 hover:underline">Ver historial completo del equipo</Link>
      {totalPages > 1 && <nav aria-label="Paginación de aprobaciones" className="flex flex-wrap items-center gap-3">
        {currentPage > 1 ? <Button asChild variant="outline" size="sm"><Link href={`/?view=approvals&approvalsPage=${currentPage - 1}`}>Anterior</Link></Button> : <Button variant="outline" size="sm" disabled>Anterior</Button>}
        <span className="text-xs text-slate-500">{currentPage} de {totalPages}</span>
        {currentPage < totalPages ? <Button asChild variant="outline" size="sm"><Link href={`/?view=approvals&approvalsPage=${currentPage + 1}`}>Siguiente</Link></Button> : <Button variant="outline" size="sm" disabled>Siguiente</Button>}
      </nav>}
    </div>
  </section>
}
