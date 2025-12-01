import { PrismaClient } from '@prisma/client'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { RegisterEmployeeForm } from '@/components/admin/register-employee-form'
import { EmployeesTable } from '@/components/admin/employees-table'
import { RefreshCw, Users, UserPlus, Building2, ArrowLeft } from 'lucide-react' 
import { Button } from '@/components/ui/button'
import { syncAllBalances } from '@/app/actions/sync-balances'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function UsersPage() {
  const session = await auth()
  
  if ((session?.user as any)?.role !== 'HR') {
    redirect('/')
  }

  const potentialBosses = await prisma.user.findMany({
    select: { 
      id: true, 
      name: true, 
      jobTitle: true,
      email: true
    },
    orderBy: { name: 'asc' }
  })

  // Obtener estadísticas
  const totalEmployees = await prisma.user.count()
  const activeEmployees = await prisma.user.count({
    where: { 
      balance: { 
        isNot: null 
      } 
    }
  })

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-[1600px] mx-auto">
          
          {/* Header Mejorado */}
          <div className="mb-8">
            {/* Breadcrumb */}
            <Link href="/">
              <Button 
                variant="ghost" 
                className="gap-2 mb-4 -ml-2 text-slate-600 hover:text-[#73C056] hover:bg-[#73C056]/5"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al Panel
              </Button>
            </Link>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                  <Building2 className="h-4 w-4" />
                  <span>Panel de RH</span>
                  <span>•</span>
                  <span className="text-[#73C056] font-semibold">Gestión de Personal</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-[#73C056]/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-[#73C056]" />
                  </div>
                  Gestión de Personal
                </h1>
              </div>
              
              {/* Botón de Sincronización */}
              <form action={async () => {
                  'use server'
                  await syncAllBalances()
              }}>
                  <Button 
                    variant="outline" 
                    className="gap-2 text-blue-600 border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all shadow-sm h-11 font-medium"
                  >
                      <RefreshCw className="h-4 w-4"/>
                      Sincronizar Antigüedades
                  </Button>
              </form>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-[#73C056]/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-[#73C056]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{totalEmployees}</p>
                    <p className="text-xs text-slate-500">Total Empleados</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <UserPlus className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{activeEmployees}</p>
                    <p className="text-xs text-slate-500">Activos</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{potentialBosses.length}</p>
                    <p className="text-xs text-slate-500">Posibles Jefes</p>
                  </div>
                </div>
              </div>

              <div className="bg-linear-to-br from-[#73C056] to-[#62a847] rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">RH</p>
                    <p className="text-xs text-white/80">Panel Activo</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Grid Principal */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
            
            {/* Formulario de Registro */}
            <div className="xl:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden sticky top-6">
                <div className="bg-linear-to-r from-[#73C056]/10 via-[#73C056]/5 to-transparent p-6 border-b border-slate-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-lg bg-[#73C056]/20 flex items-center justify-center">
                      <UserPlus className="h-5 w-5 text-[#73C056]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Registrar Empleado</h2>
                      <p className="text-sm text-slate-500">Agregar nuevo personal</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <RegisterEmployeeForm possibleBosses={potentialBosses} />
                </div>
              </div>
            </div>

            {/* Tabla de Empleados */}
            <div className="xl:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-linear-to-r from-slate-50 to-white p-6 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Users className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">Directorio de Personal</h2>
                        <p className="text-sm text-slate-500">Lista completa de empleados</p>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-slate-600">Actualizado</span>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <EmployeesTable />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}