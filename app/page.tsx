import { PrismaClient } from '@prisma/client'
import { NotificationBell } from '@/components/ui/notification-bell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RequestHistory } from '@/components/request-history'
import { VacationRequestForm } from '@/components/forms/vacation-request-form'
import { PermitRequestForm } from '@/components/forms/permit-request-form'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from '@/components/ui/button'
import { LogOut, Briefcase, Calendar, Users, FileText, Clock, ChevronRight, CheckCircle2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Image from 'next/image'
import Link from 'next/link'
import { checkAndRenewBalance } from '@/lib/check-renewal'
import { calculateVacationDays } from '@/lib/vacation-logic'
import { format, addYears, setYear, isBefore } from 'date-fns'
import { es } from 'date-fns/locale'
import { BackupManager } from '@/components/dashboard/backup-manager'
import { TeamCard } from '@/components/dashboard/team-card'
import { WhoIsOutCard } from '@/components/dashboard/who-is-out'

const prisma = new PrismaClient()

export default async function Home() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  if (session.user.id) {
    await checkAndRenewBalance(session.user.id)
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { 
        balance: true, 
        subordinates: {
          include: { balance: true }
        },
        backupUser: true,
        boss: true 
    }
  })

  const holidaysRaw = await prisma.holiday.findMany({
    select: { date: true, name: true }
  })
  
  const holidays = holidaysRaw.map(h => ({
    name: h.name,
    date: h.date.toISOString()
  }))

  const potentialBackups = await prisma.user.findMany({
    where: { 
        id: { not: user?.id },
        role: { not: 'HR' } 
    },
    select: { id: true, name: true, jobTitle: true },
    orderBy: { name: 'asc' }
  })

  if (!user) return <div className="p-8 text-red-500">Error: Usuario no encontrado en base de datos.</div>

  const totalDays = user.balance?.totalDays || 0
  const usedDays = user.balance?.usedDays || 0
  const pendingDays = user.balance?.pendingDays || 0
  const availableDays = totalDays - usedDays - pendingDays

  const today = new Date()
  const entryDate = new Date(user.entryDate)
  const currentYear = today.getFullYear()
  
  let cycleStart = setYear(entryDate, currentYear)
  if (isBefore(today, cycleStart)) {
    cycleStart = addYears(cycleStart, -1)
  }
  const cycleEnd = addYears(cycleStart, 1)

  // ─── Cálculo del próximo periodo ───
  const nextCycleStart = cycleEnd
  const nextCycleEnd = addYears(nextCycleStart, 1)
  const nextPeriodTotalDays = calculateVacationDays(user.entryDate)

  // Contar días ya pedidos del próximo periodo (aprobados + pendientes)
  // Busca solicitudes que inicien DESPUÉS del aniversario y no estén canceladas/rechazadas
  const futureRequests = await prisma.request.findMany({
    where: {
      userId: user.id,
      type: 'VACATION',
      startDate: { gte: nextCycleStart },
      status: { in: ['APPROVED', 'PENDING_BOSS', 'PENDING_HR'] }
    },
    select: { daysRequested: true }
  })
  const nextPeriodUsedDays = futureRequests.reduce((sum, r) => sum + r.daysRequested, 0)
  const nextPeriodAvailable = nextPeriodTotalDays - nextPeriodUsedDays

  const isManager = user.subordinates.length > 0;
  const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()

  // ─── Solicitudes por aprobar (Solo jefes) ───
  let pendingApprovals: any[] = []
  if (isManager) {
    pendingApprovals = await prisma.request.findMany({
      where: {
        status: 'PENDING_BOSS',
        user: {
          bossId: user.id
        }
      },
      include: {
        user: {
          select: { name: true, jobTitle: true }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: 5
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ━━━ NAVBAR ━━━ */}
      <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            
            <div className="flex items-center gap-4">
              <div className="relative h-10 w-48 lg:h-12 lg:w-64 shrink-0">
                <Image 
                  src="/logo.png" 
                  alt="Inochem Logo" 
                  fill
                  className="object-contain object-left"
                  priority
                />
              </div>
              <div className="hidden lg:block border-l border-slate-300 pl-4">
                <h1 className="font-bold text-lg text-slate-900">Sistema RH</h1>
                <p className="text-xs text-slate-500">Gestión de Vacaciones y Permisos</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-right hidden lg:block mr-1">
                <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.jobTitle}</p>
              </div>
              
              {(user as any).role === 'HR' && (
                <div className="hidden md:flex items-center gap-1.5">
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="border-[#73C056] text-[#73C056] hover:bg-[#73C056] hover:text-white transition-all h-8 text-xs">
                      <Users className="h-3.5 w-3.5 mr-1" /> Panel RH
                    </Button>
                  </Link>
                  <Link href="/admin/reports">
                    <Button variant="outline" size="sm" className="border-[#73C056] text-[#73C056] hover:bg-[#73C056] hover:text-white transition-all h-8 text-xs">
                      <FileText className="h-3.5 w-3.5 mr-1" /> Reportes
                    </Button>
                  </Link>
                  <Link href="/admin/users">
                    <Button variant="outline" size="sm" className="border-[#73C056] text-[#73C056] hover:bg-[#73C056] hover:text-white transition-all h-8 text-xs">
                      <Briefcase className="h-3.5 w-3.5 mr-1" /> Usuarios
                    </Button>
                  </Link>
                  <Link href="/admin/holidays">
                    <Button variant="outline" size="sm" className="border-[#73C056] text-[#73C056] hover:bg-[#73C056] hover:text-white transition-all h-8 text-xs">
                      <Calendar className="h-3.5 w-3.5 mr-1" /> Festivos
                    </Button>
                  </Link>
                </div>
              )}

              {isManager && (
                <Link href="/team/history">
                   <Button 
                     variant="outline" 
                     size="sm" 
                     className="hidden md:flex border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-all h-8 text-xs"
                   >
                      <Users className="h-3.5 w-3.5 mr-1" /> 
                      Gestión Equipo
                   </Button>
                </Link>
              )}
              
              <Link href="/profile">
                <Avatar className="h-9 w-9 border-2 border-white shadow-sm hover:ring-2 hover:ring-[#73C056] transition-all cursor-pointer">
                    <AvatarImage src="" className="object-cover" />
                    <AvatarFallback className="bg-slate-200 text-slate-600 font-bold text-xs">
                        {initials}
                    </AvatarFallback>
                </Avatar>
              </Link>

              <NotificationBell userId={user.id} />
              
              <form action={async () => {
                'use server'
                const { signOut } = await import('@/auth')
                await signOut({ redirectTo: '/login' })
              }}>
                <button className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all" title="Cerrar Sesión">
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* ━━━ CONTENIDO ━━━ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">

        {/* ─── BANNER: Saludo + Días Disponibles ─── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-[#73C056] to-[#5fa843] px-6 py-5 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl lg:text-2xl font-bold text-white">
                  Hola, {user.name?.split(' ')[0]} 👋
                </h2>
                <p className="text-white/80 text-sm mt-0.5">
                  {user.jobTitle}
                  {user.boss && (
                    <span className="text-white/60"> · Reporta a {user.boss.name}</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3 sm:gap-4">
                {/* Periodo actual */}
                <div className="text-center bg-white/15 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[120px]">
                  <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider mb-1">Periodo actual</p>
                  <div className="flex items-baseline gap-1 justify-center">
                    <span className={`text-3xl lg:text-4xl font-bold ${availableDays < 0 ? 'text-red-200' : 'text-white'}`}>
                      {availableDays}
                    </span>
                    <span className="text-white/50 text-xs">días</span>
                  </div>
                  {pendingDays > 0 && (
                    <div className="flex items-center gap-1 justify-center mt-1">
                      <Clock className="h-3 w-3 text-yellow-200" />
                      <span className="text-yellow-100 text-[11px] font-medium">{pendingDays} por aprobar</span>
                    </div>
                  )}
                </div>

                {/* Separador */}
                <div className="h-12 w-px bg-white/20" />

                {/* Próximo periodo */}
                <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[120px]">
                  <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider mb-1">Próximo periodo</p>
                  <div className="flex items-baseline gap-1 justify-center">
                    <span className="text-3xl lg:text-4xl font-bold text-white/80">
                      {nextPeriodAvailable}
                    </span>
                    <span className="text-white/40 text-xs">días</span>
                  </div>
                  {nextPeriodUsedDays > 0 ? (
                    <p className="text-yellow-200/70 text-[10px] mt-1">
                      {nextPeriodUsedDays} ya solicitado{nextPeriodUsedDays > 1 ? 's' : ''} de {nextPeriodTotalDays}
                    </p>
                  ) : (
                    <p className="text-white/40 text-[10px] mt-1">
                      {nextPeriodTotalDays} días desde {format(nextCycleStart, "d MMM yy", { locale: es })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-3 lg:px-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs bg-slate-50/50 border-t border-slate-100">
            {/* Desglose de saldo */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Total:</span>
              <span className="font-bold text-slate-700">{totalDays}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Usados:</span>
              <span className="font-bold text-slate-700">{usedDays}</span>
            </div>
            {pendingDays > 0 && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-orange-400" />
                <span className="text-orange-500">Por aprobar:</span>
                <span className="font-bold text-orange-600">{pendingDays}</span>
              </div>
            )}
            <div className="w-px h-4 bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#73C056]" />
              <span className="text-slate-400">Vigencia actual:</span>
              <span className="font-medium text-slate-700">
                {format(cycleStart, "d MMM yyyy", { locale: es })} — {format(cycleEnd, "d MMM yyyy", { locale: es })}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-400">Próxima:</span>
              <span className="font-medium text-slate-500">
                {format(nextCycleStart, "d MMM yyyy", { locale: es })} — {format(nextCycleEnd, "d MMM yyyy", { locale: es })}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-[#73C056]" />
              <span className="text-slate-400">Ingreso:</span>
              <span className="font-medium text-slate-700">
                {format(entryDate, "d MMM yyyy", { locale: es })}
              </span>
            </div>
          </div>
        </div>

        {/* ─── TARJETAS ─── */}
        {/* Si es jefe: 3 tarjetas. Si no: 2 tarjetas */}
        <div className={`grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 ${isManager ? 'lg:grid-cols-3' : ''} mb-6`}>
          <TeamCard subordinates={user.subordinates} />
          <WhoIsOutCard />

          {/* Tarjeta: Por Aprobar (Solo jefes) */}
          {isManager && (
            <Card className="border-l-4 border-l-orange-400 shadow-sm h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-[15px] font-bold text-slate-900 tracking-tight">
                        Por Aprobar
                      </CardTitle>
                    </div>
                  </div>
                  {pendingApprovals.length > 0 && (
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">
                      {pendingApprovals.length} pendiente{pendingApprovals.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-0 flex-1 flex flex-col">
                {pendingApprovals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-8 px-5 flex-1">
                    <div className="h-12 w-12 rounded-full bg-[#73C056]/10 flex items-center justify-center mb-3">
                      <CheckCircle2 className="h-6 w-6 text-[#73C056]/40" />
                    </div>
                    <p className="text-sm font-semibold text-slate-600">Todo al día</p>
                    <p className="text-xs text-slate-400 mt-1">No tienes solicitudes pendientes</p>
                  </div>
                ) : (
                  <div className="overflow-y-auto max-h-[280px] py-1">
                    {pendingApprovals.map((req) => {
                      const initial = req.user.name.charAt(0).toUpperCase()
                      const typeLabel = req.type === 'VACATION' ? 'Vacaciones' : 'Permiso'
                      const dateLabel = req.type === 'VACATION' && req.startDate
                        ? format(new Date(req.startDate), "d MMM", { locale: es })
                        : format(new Date(req.startDate), "d MMM", { locale: es })

                      return (
                        <Link
                          key={req.id}
                          href={`/dashboard/requests/${req.id}`}
                          className="flex items-center gap-3 px-5 py-2.5 hover:bg-orange-50/50 transition-colors group"
                        >
                          <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold bg-orange-50 text-orange-600 ring-1 ring-orange-200 shrink-0">
                            {initial}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-slate-900 truncate">
                              {req.user.name}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {typeLabel} · {req.daysRequested} {req.daysRequested === 1 ? 'día' : 'días'} · {dateLabel}
                            </p>
                          </div>

                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-orange-500 transition-colors shrink-0" />
                        </Link>
                      )
                    })}
                  </div>
                )}

                {/* Footer */}
                {pendingApprovals.length > 0 && (
                  <div className="mt-auto border-t border-slate-100 px-5 py-2.5 text-center">
                    <Link 
                      href="/team/history" 
                      className="text-[11px] text-orange-500 hover:text-orange-600 font-semibold transition-colors"
                    >
                      Ver todas las solicitudes →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ─── Gestor de Respaldo (Solo jefes) ─── */}
        {isManager && (
          <div className="mb-6">
            <BackupManager 
                employees={potentialBackups} 
                currentBackupId={user.backupId}
                currentStart={user.backupStartDate}
                currentEnd={user.backupEndDate}
            />
          </div>
        )}

        {/* ─── FORMULARIO + HISTORIAL ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-7 xl:col-span-8">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#73C056] to-[#62a847] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Nueva Solicitud</h2>
                    <p className="text-sm text-white/80">Completa el formulario correspondiente</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 sm:p-6">
                <Tabs defaultValue="vacations" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100 p-1 h-auto">
                    <TabsTrigger value="vacations" className="data-[state=active]:bg-[#73C056] data-[state=active]:text-white transition-all py-2.5">
                      <Calendar className="h-4 w-4 mr-1.5 hidden sm:inline" /> Vacaciones (FO03)
                    </TabsTrigger>
                    <TabsTrigger value="permits" className="data-[state=active]:bg-[#73C056] data-[state=active]:text-white transition-all py-2.5">
                      <FileText className="h-4 w-4 mr-1.5 hidden sm:inline" /> Permiso (FO02)
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="vacations" className="mt-0">
                    <VacationRequestForm 
                        userId={user.id} 
                        holidays={holidays}
                        userBirthDate={user.birthDate} 
                    />
                  </TabsContent>
                  
                  <TabsContent value="permits" className="mt-0">
                    <PermitRequestForm 
                        userId={user.id} 
                        userBirthDate={user.birthDate} 
                        holidays={holidays}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 xl:col-span-4">
            <div className="lg:sticky lg:top-24">
              <RequestHistory userId={user.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}