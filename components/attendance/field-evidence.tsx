import type { FieldWorkEvidence } from '@/lib/attendance/types'
import { displayTime } from '@/lib/attendance/dates'
import { durationLabel, fieldHours, type WorkSummary } from '@/lib/attendance/field-hours'

export function FieldEvidence({ rows, summary }: { rows: FieldWorkEvidence[]; summary?: WorkSummary }) {
  if (!rows.length) return null
  const services = fieldHours(rows).services
  const complete = summary && !summary.fieldConflict && (!summary.uncertainOffice || summary.fieldSeconds >= 21600) && summary.workedSeconds >= 21600
  return <div className={'mt-3 rounded-lg border p-3 text-xs ' + (complete ? 'border-green-300 bg-green-50 text-green-950' : 'border-violet-200 bg-violet-50 text-violet-950')}>
    <p className="font-semibold">Trabajo de campo y oficina</p>
    {summary ? <div className="mt-3 grid grid-cols-3 gap-2"><div><span className="block text-[10px] uppercase">Campo</span><strong>{durationLabel(summary.fieldSeconds)}</strong></div><div><span className="block text-[10px] uppercase">Oficina</span><strong>{durationLabel(summary.officeSeconds)}</strong></div><div><span className="block text-[10px] uppercase">Total</span><strong>{durationLabel(summary.workedSeconds)}</strong></div></div> : <p className="mt-2">Actualiza el cruce para calcular las horas con las reglas vigentes.</p>}
    <p className="mt-3 break-words"><strong>Dónde estuvo:</strong> {[...new Set(services.map(service => service.account || 'Sin cuenta o lugar informado'))].join(' · ') || 'Consulta el archivo de referencia'}</p>
    <details className="mt-3"><summary className="cursor-pointer font-semibold">Ver servicios y tramos de oficina</summary><ul className="mt-3 space-y-2 border-l-2 border-violet-300 pl-3">{services.map(service => <li key={service.appointment} className="rounded-md bg-white/80 p-2"><strong className="block">{service.account || 'Sin cuenta informada'}</strong><span className="block">{service.appointment} · {service.workType}</span><span className="block">{displayTime(service.startSeconds)} — {displayTime(service.endSeconds)} · {durationLabel(service.workedSeconds)}</span><span className="text-[10px]">{service.method === 'REPORTED' ? 'Duración indicada en el Excel' : 'Intervalo dentro de la jornada de esta fecha'}</span></li>)}{summary?.officeIntervals.map((interval, index) => <li key={'office-' + index} className="rounded-md border border-blue-200 bg-blue-50 p-2 text-blue-950"><strong>Oficina</strong> · {displayTime(interval.startSeconds)} — {displayTime(interval.endSeconds)}</li>)}</ul><p className="mt-2">Los tramos de oficina usan pares de checadas y excluyen los horarios de servicio. Las checadas sin pareja o los servicios superpuestos requieren revisión.</p></details>
  </div>
}

