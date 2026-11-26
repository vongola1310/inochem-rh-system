import { displayTime } from '@/lib/attendance/dates'
import type { RemoteClockPunch } from '@/lib/attendance/types'

export function RemoteEvidence({ punches = [] }: { punches?: RemoteClockPunch[] }) {
  if (!punches.length) return null
  return <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950"><p className="font-semibold">Checador remoto · evidencia con foto</p><ul className="mt-2 space-y-2">{punches.map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2"><span>{p.kind === 'ENTRY' ? 'Entrada' : 'Salida'} · {displayTime(p.seconds)}</span><a href={`/api/remote-clock/${encodeURIComponent(p.id)}/photo`} target="_blank" rel="noreferrer" className="rounded px-2 py-1 text-xs font-semibold underline">Ver foto</a></li>)}</ul><p className="mt-2 text-xs">Hora del servidor · Ciudad de México</p></div>
}
