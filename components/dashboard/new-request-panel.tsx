'use client'

import { useRouter } from 'next/navigation'
import { CalendarDays, FileText, Info } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VacationRequestForm } from '@/components/forms/vacation-request-form'
import { PermitRequestForm } from '@/components/forms/permit-request-form'

export function NewRequestPanel({ userId, userBirthDate, holidays, bossName }: {
  userId: string
  userBirthDate: Date | null
  holidays: { name: string; date: string }[]
  bossName?: string
}) {
  const router = useRouter()
  const handleSuccess = () => router.push('/?view=requests')
  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
    <section aria-label="Formulario de nueva solicitud" className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <Tabs defaultValue="vacations" className="gap-5">
        <TabsList aria-label="Tipo de solicitud" className="grid h-auto w-full grid-cols-2 rounded-lg bg-slate-100 p-1">
          <TabsTrigger value="vacations" className="gap-2 py-3 data-[state=active]:bg-[#3e712c] data-[state=active]:text-white"><CalendarDays className="h-4 w-4" />Vacaciones</TabsTrigger>
          <TabsTrigger value="permits" className="gap-2 py-3 data-[state=active]:bg-[#3e712c] data-[state=active]:text-white"><FileText className="h-4 w-4" />Permiso</TabsTrigger>
        </TabsList>
        <TabsContent value="vacations"><VacationRequestForm userId={userId} holidays={holidays} userBirthDate={userBirthDate} onSuccess={handleSuccess} /></TabsContent>
        <TabsContent value="permits"><PermitRequestForm userId={userId} holidays={holidays} userBirthDate={userBirthDate} onSuccess={handleSuccess} /></TabsContent>
      </Tabs>
    </section>
    <aside className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
      <h2 className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4 text-[#3e712c]" />Antes de enviar</h2>
      <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
        <li>Comprueba las fechas y el día en que regresas a trabajar.</li>
        <li>Revisa los días calculados antes de enviar tu solicitud.</li>
        <li>Podrás consultar su avance en «Gestionar mis solicitudes».</li>
      </ul>
      {bossName && <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">Tu jefe directo<br /><span className="font-medium text-slate-700">{bossName}</span></p>}
    </aside>
  </div>
}
