import Link from 'next/link'
import { CalendarDays, ChartNoAxesCombined, ChevronDown, ClipboardCheck, FileText, House, Menu, Settings2, UserRound, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

type NavigationProps = {
  view: 'home' | 'requests' | 'new' | 'approvals'
  isManager: boolean
  isHR: boolean
  pendingCount: number
}

export function DashboardNavigation({ view, isManager, isHR, pendingCount }: NavigationProps) {
  const links = [
    { label: 'Inicio', href: '/', icon: House, active: view === 'home', count: 0 },
    { label: 'Mis solicitudes', href: '/?view=requests', icon: FileText, active: view === 'requests' || view === 'new', count: 0 },
    ...(isManager ? [
      { label: 'Aprobaciones', href: '/?view=approvals', icon: ClipboardCheck, active: view === 'approvals', count: pendingCount },
      { label: 'Colaboradores', href: '/team/history', icon: Users, active: false, count: 0 },
    ] : []),
  ]
  const adminLinks = [
    { label: 'Panel RH', href: '/admin', icon: Settings2 },
    { label: 'Usuarios', href: '/admin/users', icon: Users },
    { label: 'Reportes', href: '/admin/reports', icon: ChartNoAxesCombined },
    { label: 'Días festivos', href: '/admin/holidays', icon: CalendarDays },
  ]
  const linkClass = 'flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e712c]'
  const content = (
    <>
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
        {links.map(({ label, href, icon: Icon, active, count }) => <li key={href}>
          <Link href={href} aria-current={active ? 'page' : undefined} className={cn(linkClass, active ? 'bg-[#e7efdf] font-semibold text-[#345d27]' : 'text-slate-600 hover:bg-white hover:text-slate-900')}>
            <Icon className="h-4 w-4 shrink-0" /><span>{label}</span>
            {count > 0 && <span className="ml-auto rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">{count}</span>}
          </Link>
        </li>)}
      </ul>
      {isHR && <div className="mt-5 border-t border-slate-200 pt-5">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Administración</p>
        <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">{adminLinks.map(({ label, href, icon: Icon }) => <li key={href}><Link href={href} className={cn(linkClass, 'text-slate-600 hover:bg-white hover:text-slate-900')}><Icon className="h-4 w-4 shrink-0" />{label}</Link></li>)}</ul>
      </div>}
      <div className="mt-5 border-t border-slate-200 pt-4"><Link href="/profile" className={cn(linkClass, 'text-slate-600 hover:bg-white hover:text-slate-900')}><UserRound className="h-4 w-4" />Mi perfil</Link></div>
    </>
  )
  return <div className="min-w-0">
    <nav aria-label="Navegación principal" className="sticky top-24 hidden lg:block"><p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Mi portal</p>{content}</nav>
    <details className="group rounded-xl border border-slate-200 bg-white lg:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3e712c] [&::-webkit-details-marker]:hidden"><Menu className="h-4 w-4" />Menú del portal<ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" /></summary>
      <nav aria-label="Navegación principal móvil" className="border-t border-slate-100 p-3">{content}</nav>
    </details>
  </div>
}
