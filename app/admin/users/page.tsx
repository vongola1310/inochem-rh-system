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

  // 1. OBTENEMOS TODOS LOS EMPLEADOS
  const allEmployees = await prisma.user.findMany({
    include: { 
      balance: true,
      boss: { select: { name: true, jobTitle: true } }
    },
    orderBy: { name: 'asc' }
  })

  // Lista simplificada para el select del formulario de registro
  const potentialBosses = allEmployees.map(e => ({
    id: e.id,
    name: e.name,
    jobTitle: e.jobTitle,
    email: e.email
  }))

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-[1600px] mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <Link href="/">
              <Button 
                variant="ghost" 
                className="gap-2 mb-4 -ml-2 text-slate-600 hover:text-[#73C056] hover:bg-[#73C056]/5"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al Panel
              </Button>
            </Link>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
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
              
              {/* BOTÓN DE SINCRONIZACIÓN */}
              {/* Envolvemos la acción para satisfacer el tipo de retorno void de TypeScript */}
              <form action={async () => {
                  'use server'
                  await syncAllBalances()
              }}>
                  <Button 
                    variant="outline" 
                    type="submit"
                    className="gap-2 text-blue-600 border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all shadow-sm h-11 font-medium"
                  >
                      <RefreshCw className="h-4 w-4"/>
                      Sincronizar Antigüedades (Ley + Bono)
                  </Button>
              </form>
            </div>
          </div>
          
          {/* Grid Principal */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
            
            {/* Formulario de Registro (Izquierda) */}
            <div className="xl:col-span-4">
              <div className="sticky top-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
            </div>

            {/* Tabla de Empleados (Derecha) */}
            <div className="xl:col-span-8">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[85vh]">
                <div className="bg-linear-to-r from-slate-50 to-white p-6 border-b border-slate-200 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                        <Users className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">Directorio de Personal</h2>
                        <p className="text-sm text-slate-500">Busca y gestiona empleados fácilmente</p>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-sm">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-slate-600">Actualizado</span>
                    </div>
                  </div>
                </div>
                
                {/* Pasamos los datos iniciales a la tabla cliente */}
                <div className="flex-1 overflow-hidden">
                    <EmployeesTable initialData={allEmployees} />
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}