import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { getPlanningData } from '@/lib/planning-data'
import { PlanningCalendar } from '@/components/planning/planning-calendar'
import { AttendanceError } from '@/lib/attendance/access'

export default async function PlanningPage({ searchParams }: { searchParams: { month?: string } }) {
  const data = await getPlanningData(searchParams.month).catch(error => {
    if (error instanceof AttendanceError) redirect('/')
    throw error
  })
  if (!data) redirect('/')
  return <main className="min-h-screen w-full bg-[#f5f7f5] p-3 text-slate-800 sm:p-5 lg:p-6">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><Link href="/" className="mb-3 inline-flex min-h-9 items-center gap-2 text-sm text-slate-600 hover:text-green-800"><ArrowLeft className="h-4 w-4" />Volver al portal</Link><h1 className="flex items-center gap-2 text-2xl font-semibold sm:text-3xl"><CalendarDays className="h-7 w-7 text-green-800" />Planeación</h1><p className="mt-2 text-sm text-slate-600">Vacaciones, permisos y ausencias de tus colaboradores, en un calendario mensual.</p></div><span className="rounded-full border border-green-200 bg-white px-4 py-2 text-sm text-green-900">{data.people.length} colaboradores a tu cargo</span></header>
    <PlanningCalendar {...data} />
  </main>
}
