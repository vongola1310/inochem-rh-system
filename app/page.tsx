import { auth, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { addYears } from 'date-fns'
import { getCycleBounds } from '@/lib/vacation-cycle'
import { ArrowLeft, ArrowRight, Clock, LogOut, Plus } from 'lucide-react'
import { checkAndRenewBalance } from '@/lib/check-renewal'
import { getDaysByYears } from '@/lib/lft-law'
import { getTeamVacationSummaries } from '@/lib/team-vacations'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/components/ui/notification-bell'
import { RequestHistory } from '@/components/request-history'
import { BackupManager } from '@/components/dashboard/backup-manager'
import { TeamCard } from '@/components/dashboard/team-card'
import { WhoIsOutCard } from '@/components/dashboard/who-is-out'
import { DashboardNavigation } from '@/components/dashboard/dashboard-navigation'
import { VacationBalanceSummary } from '@/components/dashboard/vacation-balance-summary'
import { NewRequestPanel } from '@/components/dashboard/new-request-panel'
import { PendingApprovals } from '@/components/dashboard/pending-approvals'

export default async function Home({ searchParams }: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const session = await auth()
  if (!session?.user?.email) redirect('/login')
  if (session.user.id) await checkAndRenewBalance(session.user.id)

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true, name: true, jobTitle: true, role: true, canUploadFieldReports: true, isBlacklisted: true,
      entryDate: true, birthDate: true, balance: true,
      backupId: true, backupStartDate: true, backupEndDate: true,
      subordinates: { select: { id: true } },
      boss: { select: { name: true } },
    },
  })
  if (!user) return <p className="p-8 text-red-700">No se encontró tu usuario. Contacta a Recursos Humanos.</p>

  const view = searchParams.view === 'new' || searchParams.view === 'approvals' || searchParams.view === 'requests'
    ? searchParams.view : 'home'
  const isManager = user.subordinates.length > 0
  if (view === 'approvals' && !isManager) redirect('/')
  const showOverview = view === 'home' || view === 'requests'
  const totalDays = user.balance?.totalDays || 0
  const usedDays = user.balance?.usedDays || 0
  const pendingDays = user.balance?.pendingDays || 0
  const entryDate = new Date(user.entryDate)
  const { cycleStart, cycleEnd } = getCycleBounds(entryDate)
  const nextCycleStart = cycleEnd
  const nextCycleEnd = addYears(nextCycleStart, 1)
  const nextPeriodTotalDays = getDaysByYears(nextCycleStart.getFullYear() - entryDate.getFullYear())

  const [futureRequests, pendingApprovalsCount, teamMembers, potentialBackups, holidaysRaw, pendingHR] = await Promise.all([
    prisma.request.findMany({
      where: {
        userId: user.id, type: 'VACATION', startDate: { gte: nextCycleStart, lt: nextCycleEnd },
        status: { in: ['APPROVED', 'PENDING_BOSS', 'PENDING_HR', 'CANCELLATION_REQUESTED'] },
      },
      select: { daysRequested: true },
    }),
    isManager ? prisma.request.count({ where: { status: 'PENDING_BOSS', user: { bossId: user.id } } }) : Promise.resolve(0),
    isManager && showOverview ? getTeamVacationSummaries(user.id) : Promise.resolve([]),
    isManager && showOverview ? prisma.user.findMany({
      where: { id: { not: user.id }, role: { not: 'HR' } },
      select: { id: true, name: true, jobTitle: true }, orderBy: { name: 'asc' },
    }) : Promise.resolve([]),
    view === 'new' ? prisma.holiday.findMany({ select: { date: true, name: true } }) : Promise.resolve([]),
    prisma.request.aggregate({
      where: { userId: user.id, type: 'VACATION', status: 'PENDING_HR', startDate: { gte: cycleStart, lt: cycleEnd } },
      _sum: { daysRequested: true },
    }),
  ])
  const nextPeriodUsedDays = futureRequests.reduce((sum, request) => sum + request.daysRequested, 0)
  const initials = user.name.split(' ').map(name => name[0]).join('').substring(0, 2).toUpperCase()
  const titles = {
    home: `Hola, ${user.name.split(' ')[0]}`, requests: 'Mis solicitudes',
    new: 'Nueva solicitud', approvals: 'Aprobaciones de mi equipo',
  }
  const descriptions = {
    home: 'Consulta tus días disponibles y da seguimiento a tus solicitudes.',
    requests: 'Consulta el estado de tus vacaciones y permisos.',
    new: 'Elige el tipo de solicitud y completa los datos.',
    approvals: 'Revisa las solicitudes que necesitan tu autorización.',
  }

  return (
    <div className="min-h-screen bg-[#f5f7f5] text-slate-800">
      <a href="#dashboard-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:p-3 focus:shadow-lg">Ir al contenido</a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Inochem, inicio" className="flex min-w-0 items-center gap-6 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e712c]">
            <span className="relative block h-9 w-32 shrink-0 sm:w-40">
              <Image src="/logo.png" alt="Inochem" fill sizes="(min-width: 640px) 160px, 128px" className="object-contain object-left" priority />
            </span>
            <span className="hidden border-l border-slate-200 pl-6 text-sm text-slate-500 md:block">Portal de colaboradores</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <NotificationBell userId={user.id} />
            <Link href="/profile" aria-label="Ver mi perfil" className="flex items-center gap-3 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e712c]">
              <div className="hidden text-right lg:block"><p className="max-w-48 truncate text-sm font-semibold">{user.name}</p><p className="max-w-48 truncate text-xs text-slate-500">{user.jobTitle}</p></div>
              <Avatar className="h-9 w-9 border border-[#dce8d7]"><AvatarFallback className="bg-[#edf4e9] text-xs font-semibold text-[#3e712c]">{initials}</AvatarFallback></Avatar>
            </Link>
            <form action={async () => {
              'use server'
              await signOut({ redirectTo: '/login' })
            }}>
              <button type="submit" aria-label="Cerrar sesión" title="Cerrar sesión" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e712c]"><LogOut className="h-4 w-4" /></button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:py-8">
        <DashboardNavigation canUploadFieldReports={(user.canUploadFieldReports || user.role === 'HR' || user.role === 'ADMIN') && !user.isBlacklisted} view={view} isManager={isManager} isHR={user.role === 'HR'} isAdmin={user.role === 'ADMIN'} pendingCount={pendingApprovalsCount} />
        <main id="dashboard-content" className="min-w-0 scroll-mt-24 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              {view === 'new' ? <Link href="/" className="mb-3 inline-flex items-center gap-1.5 rounded text-xs font-medium text-slate-600 hover:text-[#3e712c] focus-visible:ring-2 focus-visible:ring-[#3e712c]"><ArrowLeft className="h-3.5 w-3.5" /> Volver a mi espacio</Link>
                : <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#527346]">Mi espacio</p>}
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{titles[view]}</h1>
              <p className="mt-2 text-sm text-slate-500">{descriptions[view]}</p>
            </div>
            {view !== 'new' && <Button asChild className="h-11 gap-2 rounded-lg bg-[#3e712c] px-5 text-white shadow-none hover:bg-[#315a23]"><Link href="/?view=new"><Plus className="h-4 w-4" /> Nueva solicitud</Link></Button>}
          </div>

          {view === 'home' && <VacationBalanceSummary totalDays={totalDays} usedDays={usedDays} pendingDays={pendingDays} pendingHRDays={pendingHR._sum.daysRequested ?? 0} cycleStart={cycleStart} cycleEnd={cycleEnd} nextTotalDays={nextPeriodTotalDays} nextRequestedDays={nextPeriodUsedDays} nextCycleStart={nextCycleStart} nextCycleEnd={nextCycleEnd} />}
          {view === 'new' && <div aria-label="Días disponibles" className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-[#dce8d7] bg-[#edf4e9] px-5 py-3 text-sm text-[#345d27]">
            <p>Periodo actual: <strong>{totalDays - usedDays - pendingDays} días disponibles</strong></p>
            <p>Próximo periodo: <strong>{nextPeriodTotalDays - nextPeriodUsedDays} días disponibles</strong></p>
          </div>}
          {view === 'home' && pendingApprovalsCount > 0 && (
            <Link href="/?view=approvals" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600">
              <span className="flex items-center gap-3"><Clock className="h-4 w-4 shrink-0" /><span>Tu equipo tiene <strong>{pendingApprovalsCount} {pendingApprovalsCount === 1 ? 'solicitud por revisar' : 'solicitudes por revisar'}</strong>.</span></span>
              <span className="flex items-center gap-2 font-semibold">Revisar <ArrowRight className="h-4 w-4" /></span>
            </Link>
          )}
          {view === 'new' && <NewRequestPanel userId={user.id} userBirthDate={user.birthDate} holidays={holidaysRaw.map(holiday => ({ name: holiday.name, date: holiday.date.toISOString() }))} bossName={user.boss?.name} />}
          {view === 'approvals' && <PendingApprovals managerId={user.id} totalRequests={pendingApprovalsCount} requestedPage={searchParams.approvalsPage} />}
          {showOverview && (
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_296px]">
              <section id="my-requests" aria-label="Gestionar mis solicitudes" className="min-w-0 scroll-mt-24"><RequestHistory userId={user.id} searchParams={searchParams} /></section>
              <aside aria-label="Información de apoyo" className={`grid min-w-0 gap-5 ${isManager ? 'sm:grid-cols-2' : ''} xl:grid-cols-1`}>
                <div className="min-w-0 sm:row-span-2 xl:row-span-1"><WhoIsOutCard /></div>
                {isManager && <TeamCard members={teamMembers} />}
                {isManager && <BackupManager employees={potentialBackups} currentBackupId={user.backupId} currentStart={user.backupStartDate} currentEnd={user.backupEndDate} />}
              </aside>
            </div>
          )}
          <p className="pb-2 text-xs text-slate-500">¿Necesitas ayuda con tus vacaciones o permisos? Contacta a Recursos Humanos.</p>
        </main>
      </div>
    </div>
  )
}
