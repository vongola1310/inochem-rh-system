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
import { LogOut, Briefcase, Calendar, Users, FileText, UserCircle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Image from 'next/image'
import Link from 'next/link'
import { checkAndRenewBalance } from '@/lib/check-renewal'
import { format, addYears, setYear, isBefore } from 'date-fns'
import { es } from 'date-fns/locale'
import { BackupManager } from '@/components/dashboard/backup-manager'
import { TeamCard } from '@/components/dashboard/team-card'

const prisma = new PrismaClient()

export default async function Home() {
  const session = await auth()

  if (!session?.user?.email) {
    redirect('/login')
  }

  // 1. Renovación automática al entrar
  if (session.user.id) {
    await checkAndRenewBalance(session.user.id)
  }

  // 2. Obtener datos del usuario
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { 
        balance: true, 
        subordinates: true,
        backupUser: true,
        boss: true 
    }
  })

  // 3. Obtener días festivos
  const holidaysRaw = await prisma.holiday.findMany({
    select: { date: true, name: true }
  })
  
  const holidays = holidaysRaw.map(h => ({
    name: h.name,
    date: h.date.toISOString()
  }))

  // 4. Obtener lista para respaldo
  const potentialBackups = await prisma.user.findMany({
    where: { 
        id: { not: user?.id },
        role: { not: 'HR' } 
    },
    select: { id: true, name: true, jobTitle: true },
    orderBy: { name: 'asc' }
  })

  if (!user) return <div className="p-8 text-red-500">Error: Usuario no encontrado en base de datos.</div>

  // --- CÁLCULOS ---
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

  const isManager = user.subordinates.length > 0;
  
  const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-slate-100 to-slate-50">
      {/* NAVBAR */}
      <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* LOGO Y TÍTULO */}
            <div className="flex items-center gap-4">
              <div className="relative h-12 w-64 shrink-0">
                <Image 
                  src="/logo.png" 
                  alt="Inochem Logo" 
                  fill
                  className="object-contain object-left"
                  priority
                />
              </div>
              <div className="hidden lg:block border-l border-slate-300 pl-4">
                <h1 className="font-bold text-xl text-slate-900">Sistema RH</h1>
                <p className="text-xs text-slate-500">Solicitud de Vacaciones</p>
              </div>
            </div>
            
            {/* Usuario y Acciones */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-600">{user.jobTitle}</p>
              </div>
              
              {/* Botones Admin (Solo RH) */}
              {(user as any).role === 'HR' && (
                <div className="hidden md:flex items-center gap-2">
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="border-[#73C056] text-[#73C056] hover:bg-[#73C056] hover:text-white transition-all">
                      <Users className="h-4 w-4 mr-1.5" /> Panel RH
                    </Button>
                  </Link>
                  <Link href="/admin/reports">
                    <Button variant="outline" size="sm" className="border-[#73C056] text-[#73C056] hover:bg-[#73C056] hover:text-white transition-all">
                      <FileText className="h-4 w-4 mr-1.5" /> Reportes
                    </Button>
                  </Link>
                  <Link href="/admin/users">
                    <Button variant="outline" size="sm" className="border-[#73C056] text-[#73C056] hover:bg-[#73C056] hover:text-white transition-all">
                      <Briefcase className="h-4 w-4 mr-1.5" /> Usuarios
                    </Button>
                  </Link>
                  <Link href="/admin/holidays">
                    <Button variant="outline" size="sm" className="border-[#73C056] text-[#73C056] hover:bg-[#73C056] hover:text-white transition-all">
                      <Calendar className="h-4 w-4 mr-1.5" /> Días festivos
                    </Button>
                  </Link>
                </div>
              )}
              
              <Link href="/profile">
                <Avatar className="h-10 w-10 border-2 border-white shadow-sm hover:ring-2 hover:ring-[#73C056] transition-all cursor-pointer">
                    <AvatarImage src="" className="object-cover" />
                    <AvatarFallback className="bg-slate-200 text-slate-600 font-bold">
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
                <button className="flex items-center justify-center h-10 w-10 rounded-lg bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600 transition-all" title="Cerrar Sesión">
                  <LogOut className="h-5 w-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* DASHBOARD */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mb-6 lg:hidden">
          <h2 className="text-xl font-bold text-slate-900">Hola, {user.name?.split(' ')[0]} 👋</h2>
          <p className="text-sm text-slate-600">{user.jobTitle}</p>
        </div>

        {/* Tarjetas */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6 lg:mb-8">
          
          {/* Tarjeta 1: Puesto + JEFE */}
          <Card className="border-l-4 border-l-[#73C056] hover:shadow-lg transition-all hover:-translate-y-1 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600">Mi Puesto</CardTitle>
                <div className="h-10 w-10 rounded-full bg-[#73C056]/10 flex items-center justify-center shrink-0">
                  <Briefcase className="h-5 w-5 text-[#73C056]" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {/* CAMBIO: Se eliminó 'truncate' y 'text-xl' para permitir salto de línea */}
              <div className="text-lg font-bold text-slate-900 leading-snug mb-1" title={user.jobTitle || ''}>
                {user.jobTitle}
              </div>
              <p className="text-xs text-slate-500 mb-4">Cargo actual</p>
              
              <div className="mt-auto">
                {user.boss && (
                   <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-slate-200 shrink-0">
                          <AvatarFallback className="bg-slate-100 text-slate-600 text-xs font-bold">
                              {user.boss.name.charAt(0)}
                          </AvatarFallback>
                      </Avatar>
                      <div className="overflow-hidden">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Reporta a</p>
                          <p className="text-sm font-semibold text-slate-800 truncate leading-tight" title={user.boss.name}>
                              {user.boss.name}
                          </p>
                      </div>
                   </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Tarjeta 2: Días Disponibles */}
          <Card className="border-l-4 border-l-[#73C056] hover:shadow-lg transition-all hover:-translate-y-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-slate-600">Días Disponibles</CardTitle>
                <div className="h-10 w-10 rounded-full bg-[#73C056]/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-5 w-5 text-[#73C056]" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl sm:text-4xl font-bold ${availableDays < 0 ? 'text-red-500' : 'text-[#73C056]'}`}>
                  {availableDays}
                </span>
                <span className="text-sm text-slate-600 font-medium">días</span>
              </div>
              
              <div className="text-xs text-slate-500 mt-2 flex flex-col gap-0.5">
                <div className="flex justify-between font-medium">
                    <span className="text-slate-400">Vigencia:</span>
                    <span className="text-slate-700">
                        {format(cycleStart, "d MMM yyyy", { locale: es })} - {format(cycleEnd, "d MMM yyyy", { locale: es })}
                    </span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-400">Fecha Ingreso:</span>
                    <span>{format(entryDate, "d MMM yyyy", { locale: es })}</span>
                </div>
                {pendingDays > 0 && <span className="text-orange-600 font-medium mt-1">({pendingDays} días en aprobación)</span>}
              </div>
            </CardContent>
          </Card>

          {/* Tarjeta 3: Mi Equipo */}
          <TeamCard subordinates={user.subordinates} />
          
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* COLUMNA IZQUIERDA - FORMULARIOS Y GESTIÓN */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            
            {/* Gestor de Respaldo (Solo si es jefe) */}
            {isManager && (
                <BackupManager 
                    employees={potentialBackups} 
                    currentBackupId={user.backupId}
                    currentStart={user.backupStartDate}
                    currentEnd={user.backupEndDate}
                />
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-linear-to-r from-[#73C056] to-[#62a847] p-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-black">Nueva Solicitud</h2>
                    <p className="text-sm text-black/90">Completa el formulario correspondiente</p>
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
                    <VacationRequestForm userId={user.id} holidays={holidays} />
                  </TabsContent>
                  
                  <TabsContent value="permits" className="mt-0">
                    <PermitRequestForm 
                        userId={user.id} 
                        userBirthDate={user.birthDate} 
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA - HISTORIAL */}
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