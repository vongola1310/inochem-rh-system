'use client'

import { useState } from 'react'
import { AttendanceActionForm } from '@/components/attendance/action-form'
import { Input } from '@/components/ui/input'
import { confirmFieldReport, saveFieldReportMappings, cancelFieldReport } from '@/app/actions/field-reports'
import type { FieldEmployee, FieldMapping, FieldSource } from '@/lib/field-reports/types'

function PersonPicker({ owner, value, employees, onChange }: { owner: string; value: string; employees: FieldEmployee[]; onChange: (id: string) => void }) {
  const [search, setSearch] = useState('')
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const words = normalize(search).split(/\s+/).filter(Boolean)
  const visible = employees.filter(employee => employee.id === value || words.every(word => normalize(employee.name + ' ' + employee.employeeNumber).includes(word)))
  return <div className="space-y-2"><Input aria-label={'Buscar colaborador para ' + owner} placeholder="Buscar colaborador por nombre o número…" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label={'Vincular ' + owner} value={value} onChange={e => onChange(e.target.value)} className="h-11 w-full min-w-0 rounded-md border bg-white px-2 text-sm"><option value="">Selecciona un colaborador</option><option value="exclude">Omitir a esta persona con motivo</option>{visible.map(employee => <option key={employee.id} value={employee.id}>{employee.name} · {employee.employeeNumber}</option>)}</select></div>
}

export function FieldReportPanel({ id, version, status, editable, source, mappings, employees }: {
  id: string; version: number; status: string; editable: boolean; source: FieldSource; mappings: FieldMapping; employees: FieldEmployee[]
}) {
  const [configuration, setConfiguration] = useState(mappings), [dirty, setDirty] = useState(false), [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const owners = [...new Set(source.records.map(row => row.owner).filter(Boolean))].sort()
  const change = (owner: string, value: FieldMapping[string]) => { setConfiguration({ ...configuration, [owner]: value }); setDirty(true) }
  const rows = source.records.filter(row => (row.owner + ' ' + row.appointment + ' ' + row.workOrder).toLowerCase().includes(search.toLowerCase()))
  const shownPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 30)))
  const mappingFields = <div className="space-y-4">{owners.map(owner => {
    const mapping = Object.hasOwn(configuration, owner) ? configuration[owner] : undefined
    return <div key={owner} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2"><div><p className="text-sm font-semibold">{owner}</p><p className="mt-1 text-xs text-slate-500">Nombre en Salesforce</p></div><div className="space-y-2"><PersonPicker owner={owner} value={mapping ? mapping.userId || (mapping.reason ? 'exclude' : '') : ''} employees={employees.filter(employee => !employee.isBlacklisted)} onChange={value => change(owner, { userId: value === 'exclude' || !value ? null : value, reason: value === 'exclude' ? 'Omitido por el responsable: pendiente de identificar.' : value ? 'Vinculación revisada por el responsable.' : '' })} />{mapping && !mapping.userId && <Input required maxLength={500} aria-label={'Motivo para omitir ' + owner} value={mapping.reason} onChange={e => change(owner, { ...mapping, reason: e.target.value })} />}</div></div>
  })}</div>
  return <div className="space-y-6">
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm leading-relaxed"><h2 className="font-semibold">Archivo de referencia</h2><p className="mt-2">Aquí se conserva el reporte de Salesforce. Al cargar los biochecadores, la plataforma combinará los servicios de campo con las checadas de oficina para evaluar la asistencia. Se sumarán las horas de servicios y los tramos de oficina sin duplicar tiempos. Con 6 horas o más no habrá incidencia de asistencia; los registros incompletos o contradictorios requerirán revisión.</p></section>
    <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Datos originales del archivo</h2>
      <div className="grid grid-cols-2 gap-3">{[['Registros guardados', source.records.length], ['Personas en el archivo', owners.length]].map(([label, count]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><strong className="mt-2 block text-xl">{count}</strong></div>)}</div>
      <Input aria-label="Buscar servicios de campo" placeholder="Buscar por nombre, cita u orden…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
      <div className="max-h-[560px] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-100"><tr>{['Fila / cita', 'Colaborador', 'Inicio original', 'Fin original', 'Estado Salesforce', 'Datos del archivo'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{rows.slice((shownPage - 1) * 30, shownPage * 30).map(row => <tr key={row.row} className="border-t"><td className="p-3">{row.row} · {row.appointment}<span className="block text-slate-500">Orden {row.workOrder}</span></td><td className="min-w-40 p-3">{row.owner}</td><td className="whitespace-nowrap p-3">{row.rawStart || 'Sin fecha'}</td><td className="whitespace-nowrap p-3">{row.rawEnd || 'Sin fecha'}</td><td className="p-3">{row.status}</td><td className="min-w-44 p-3 text-slate-600">{row.issues.join(' · ') || 'Guardados'}</td></tr>)}</tbody></table></div>
      <div className="flex items-center justify-end gap-3 text-sm"><button type="button" className="min-h-10 rounded border px-3 disabled:opacity-40" disabled={shownPage === 1} onClick={() => setPage(shownPage - 1)}>Anterior</button><span>{shownPage} / {Math.max(1, Math.ceil(rows.length / 30))}</span><button type="button" className="min-h-10 rounded border px-3 disabled:opacity-40" disabled={shownPage * 30 >= rows.length} onClick={() => setPage(shownPage + 1)}>Siguiente</button></div>
    </section>
    <section className="rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Correspondencias de colaboradores</h2><p className="my-3 text-sm text-slate-600">Puedes corregir los nombres para el próximo cruce con biochecadores. Los pendientes se señalarán antes de publicar las incidencias.</p>
      {editable && status !== 'CANCELLED' ? <AttendanceActionForm label="Guardar correspondencias" action={async form => { form.set('mappings', JSON.stringify(configuration)); return saveFieldReportMappings(form) }}><input type="hidden" name="reportId" value={id} /><input type="hidden" name="version" value={version} />{mappingFields}</AttendanceActionForm> : <ul className="space-y-2 text-sm">{owners.map(owner => <li key={owner}>{owner} → {employees.find(employee => employee.id === mappings[owner]?.userId)?.name || 'Omitido / sin vincular'}</li>)}</ul>}
      {dirty && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Hay correspondencias pendientes de guardar.</p>}
    </section>
    {editable && status === 'DRAFT' && <section className="rounded-xl border bg-white p-5"><p className="mb-3 text-sm">Este borrador se cargó con el flujo anterior. Guárdalo como referencia para usarlo en el próximo cruce.</p><AttendanceActionForm action={confirmFieldReport} label="Guardar como referencia" disabled={dirty}><input type="hidden" name="reportId" value={id} /><input type="hidden" name="version" value={version} /></AttendanceActionForm></section>}
    {editable && status !== 'CANCELLED' && <details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer text-sm font-medium text-red-700">Cancelar referencia</summary><AttendanceActionForm action={cancelFieldReport} label="Cancelar referencia" className="mt-4"><input type="hidden" name="reportId" value={id} /><input type="hidden" name="version" value={version} /><p className="text-sm text-slate-600">Se conservará el archivo, pero dejará de usarse en los siguientes cruces. Los periodos existentes quedarán pendientes de actualización por RH.</p><Input name="reason" placeholder="Motivo de la cancelación" required minLength={5} maxLength={500} /></AttendanceActionForm></details>}
  </div>
}

