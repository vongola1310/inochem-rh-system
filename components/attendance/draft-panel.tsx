'use client'

import { useState } from 'react'
import Link from 'next/link'
import { updateAttendanceDraft, publishAttendanceImport } from '@/app/actions/attendance-imports'
import { AttendanceActionForm } from './action-form'
import { AttendancePreviewTable } from './preview-table'
import { ReviewerPicker } from './reviewer-picker'
import { Input } from '@/components/ui/input'
import type { ImportConfiguration, Preview, Site } from '@/lib/attendance/types'

type Person = { id: string; name: string; employeeNumber: string; bossId: string | null }
const TEMPORARY_OMISSION_REASON = 'Omitido por ahora: ID sin correspondencia; pendiente de identificar. Solo para este periodo.'
export function AttendanceDraftPanel({ id, version, initialConfig, preview, employees }: { id: string; version: number; initialConfig: ImportConfiguration; preview: Preview; employees: Person[] }) {
  const [config, setConfig] = useState(initialConfig), [dirty, setDirty] = useState(false), [search, setSearch] = useState('')
  const modify = (next: ImportConfiguration) => { setConfig(next); setDirty(true) }
  const unresolved = preview.identities.filter(identity => !identity.userId && !config.mappings[identity.key]?.userId && !config.mappings[identity.key]?.reason.trim())
  const omitForNow = (keys: string[]) => {
    const mappings = { ...config.mappings }
    for (const key of keys) if (unresolved.some(identity => identity.key === key)) mappings[key] = { userId: null, reason: TEMPORARY_OMISSION_REASON }
    modify({ ...config, mappings })
  }
  const selectClass = 'h-10 w-full min-w-48 rounded-md border border-slate-300 bg-white px-2 text-sm'
  return <div className="space-y-6">
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm"><h2 className="font-semibold">Cruce con reportes de campo guardados</h2>{preview.fieldReferences?.length ? <><p className="my-2">Esta evaluación combina las checadas de oficina con estas referencias:</p><ul className="space-y-2">{preview.fieldReferences.map(report => <li key={report.id}><Link href={'/field-reports/' + report.id} className="break-words underline">{report.fileName}</Link></li>)}</ul></> : <p className="mt-2">No hay reportes de campo guardados para estas fechas. Puedes cargarlos en Reportes de campo y después actualizar esta vista previa.</p>}</section>
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">1. Confirma personas y responsables</h2><p className="mb-5 mt-2 text-sm text-slate-500">El padrón incluye a todos los colaboradores seleccionados, aunque no tengan checadas. Toda exclusión debe tener un motivo.</p>
      <AttendanceActionForm label="Guardar configuración y recalcular vista previa" action={async form => { form.set('configuration', JSON.stringify(config)); return updateAttendanceDraft(form) }}>
        <input type="hidden" name="importId" value={id} /><input type="hidden" name="version" value={version} />
        <details open={preview.identities.some(i => !i.userId && !i.excluded)} className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer font-medium">Vinculación de números de checador</summary><p className="mt-2 text-xs text-slate-500">El cruce automático usa el número de empleado. Cambiarlo o excluirlo requiere un motivo.</p><div className="mt-4 max-h-[420px] space-y-4 overflow-y-auto">
          {preview.identities.map(identity => {
            if (identity.excluded && identity.userId && !employees.some(e => e.id === identity.userId)) return <p key={identity.key} className="rounded-md bg-slate-100 p-3 text-sm">{identity.name} · {identity.externalId} · Excluido automáticamente por lista negra</p>
            const explicit = config.mappings[identity.key]
            const value = explicit ? explicit.userId || 'exclude' : identity.userId || ''
            const omittedForNow = !explicit?.userId && explicit?.reason === TEMPORARY_OMISSION_REASON
            return <div key={identity.key} className="grid gap-2 border-b border-slate-100 pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]"><div className="text-sm"><p className="font-medium">{identity.name}</p><p className="text-xs text-slate-500">{identity.site} · ID {identity.externalId}</p></div><div className="space-y-2">
              {unresolved.some(item => item.key === identity.key) && <button type="button" aria-label={`Omitir por ahora ${identity.site} ${identity.externalId}`} className="min-h-10 rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-medium text-amber-900" onClick={() => omitForNow([identity.key])}>Omitir por ahora</button>}
              {omittedForNow && <div className="rounded-md bg-slate-100 p-3 text-xs text-slate-700"><p>Omitido por ahora · solo este periodo. Sus checadas originales se conservan.</p><button type="button" className="mt-2 min-h-9 font-semibold underline" onClick={() => { const mappings = { ...config.mappings }; delete mappings[identity.key]; modify({ ...config, mappings }) }}>Volver a vincular</button></div>}
              <select aria-label={`Vincular ${identity.site} ${identity.externalId}`} className={selectClass} value={value} onChange={e => modify({ ...config, mappings: { ...config.mappings, [identity.key]: { userId: e.target.value === 'exclude' || !e.target.value ? null : e.target.value, reason: omittedForNow && e.target.value !== 'exclude' ? '' : explicit?.reason || '' } } })}><option value="">Sin correspondencia</option><option value="exclude">Excluir este ID del archivo</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name} · {e.employeeNumber}</option>)}</select>{explicit && <Input aria-label={`Motivo de vinculación ${identity.externalId}`} placeholder="Motivo de la vinculación o exclusión" required maxLength={500} value={explicit.reason} onChange={e => modify({ ...config, mappings: { ...config.mappings, [identity.key]: { ...explicit, reason: e.target.value } } })} />}</div></div>
          })}
        </div></details>
        <Input aria-label="Buscar en padrón" placeholder="Buscar nombre o número en el padrón…" value={search} onChange={e => setSearch(e.target.value)} />
        <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Sede para aplicar jornadas reducidas</summary><p className="my-3 text-xs text-slate-500">Se usa la sede de las checadas. Si falta información o necesitas corregirla, selecciona la sede del colaborador para este periodo.</p><div className="max-h-72 space-y-3 overflow-auto">{employees.filter(employee => config.includedUserIds.includes(employee.id)).map(employee => <label key={employee.id} className="grid items-center gap-2 text-sm sm:grid-cols-2">{employee.name}<select aria-label={'Sede de ' + employee.name} className="h-10 rounded-md border bg-white px-2" value={config.sites?.[employee.id] || ''} onChange={event => { const sites = { ...config.sites }; if (event.target.value) sites[employee.id] = event.target.value as Site; else delete sites[employee.id]; modify({ ...config, sites }) }}><option value="">Según las checadas</option><option value="AJUSCO">Ajusco</option><option value="PERIFERICO">Periférico</option></select></label>)}</div></details>
        <div className="max-h-[440px] space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">{employees.filter(e => `${e.name} ${e.employeeNumber}`.toLowerCase().includes(search.toLowerCase())).map(employee => {
          const included = config.includedUserIds.includes(employee.id)
          return <div key={employee.id} className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2"><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={included} onChange={e => modify({ ...config, includedUserIds: e.target.checked ? [...config.includedUserIds, employee.id] : config.includedUserIds.filter(id => id !== employee.id) })} /><span><span className="font-medium">{employee.name}</span><span className="mt-1 block text-xs text-slate-500">#{employee.employeeNumber}</span></span></label>{included ? <ReviewerPicker value={config.reviewers[employee.id] ?? employee.bossId ?? ''} employeeName={employee.name} employees={employees.filter(e => e.id !== employee.id)} onChange={value => modify({ ...config, reviewers: { ...config.reviewers, [employee.id]: value } })} /> : <Input aria-label={`Motivo de exclusión de ${employee.name}`} required placeholder="Motivo de exclusión del padrón" maxLength={500} value={config.excludedUsers[employee.id] || ''} onChange={e => modify({ ...config, excludedUsers: { ...config.excludedUsers, [employee.id]: e.target.value } })} />}</div>
        })}</div>
      </AttendanceActionForm>
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><h2 className="mb-4 text-lg font-semibold">2. Revisa la evaluación diaria</h2>
      {dirty && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Hay cambios sin recalcular. Guarda la configuración para actualizar esta tabla.</p>}
      {!!preview.errors.length && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">Resuelve estos puntos antes de publicar:</p><ul className="mt-2 list-disc space-y-1 pl-5">{preview.errors.map(error => <li key={error}>{error}</li>)}</ul>{unresolved.length > 0 && <div className="mt-4 border-t border-red-200 pt-3"><button type="button" className="min-h-11 rounded-md border border-red-300 bg-white px-3 font-semibold" onClick={() => omitForNow(unresolved.map(identity => identity.key))}>Omitir {unresolved.length} IDs sin correspondencia por ahora</button><p className="mt-2 text-xs leading-relaxed">Se guardará automáticamente el motivo «Pendiente de identificar» para este periodo. Después pulsa «Guardar configuración y recalcular vista previa». Las checadas originales se conservan; los IDs omitidos no se asignan a un colaborador.</p></div>}</div>}
      {!!preview.warnings.length && <ul className="mb-4 list-disc space-y-1 rounded-lg bg-amber-50 p-4 pl-8 text-sm text-amber-900">{preview.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
      <AttendancePreviewTable days={preview.days} employees={employees} period={preview.period} />
    </section>
    <section className="rounded-xl border border-[#dce8d7] bg-[#edf4e9] p-5 sm:p-6"><h2 className="mb-4 text-lg font-semibold">3. Confirmar y enviar al portal</h2><AttendanceActionForm action={publishAttendanceImport} label="Confirmar y notificar a los colaboradores" disabled={dirty || preview.errors.length > 0 || !preview.days.length}>
      <input type="hidden" name="importId" value={id} /><input type="hidden" name="version" value={version} />
      <label className="flex items-start gap-3 text-sm leading-relaxed"><input type="checkbox" name="confirmed" value="yes" required className="mt-1" />Revisé ambos archivos, el padrón, las vinculaciones y la tabla de incidencias. Confirmo el envío a los colaboradores que participan en el proceso. Quienes tienen N/A conservan sus checadas sin recibir incidencias.</label>
    </AttendanceActionForm></section>
  </div>
}
