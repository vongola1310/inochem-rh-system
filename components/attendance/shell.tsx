import Link from 'next/link'
import { ArrowLeft, CalendarCheck, HeartPulse, Upload, Users } from 'lucide-react'

export function AttendanceShell({ title, description, role, children }: { title: string; description: string; role: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-[#f5f7f5] px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-[1480px] space-y-6">
      <Link href="/" className="inline-flex items-center gap-2 rounded text-sm text-slate-600 hover:text-[#3e712c]"><ArrowLeft className="h-4 w-4" />Volver al portal</Link>
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#527346]">Asistencia y ausencias</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p></div>
      <nav aria-label="Asistencia" className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {['HR', 'ADMIN'].includes(role) && <Link className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50" href="/admin/reduced-workdays"><CalendarCheck className="h-4 w-4" />Jornadas reducidas</Link>}
        <Link className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50" href="/attendance"><CalendarCheck className="h-4 w-4" />Mi asistencia</Link>
        <Link className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50" href="/attendance?view=team"><Users className="h-4 w-4" />Dictámenes a mi cargo</Link>
        {['HR', 'ADMIN'].includes(role) && <Link className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50" href="/admin/attendance"><Upload className="h-4 w-4" />Periodos y reportes</Link>}
        {['HR', 'ADMIN'].includes(role) && <Link className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50" href="/admin/medical-leaves"><HeartPulse className="h-4 w-4" />Incapacidades</Link>}
        {['HR', 'ADMIN'].includes(role) && <Link className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm hover:bg-slate-50" href="/field-reports"><Upload className="h-4 w-4" />Reportes de campo</Link>}
      </nav>
      {children}
    </div>
  </main>
}
