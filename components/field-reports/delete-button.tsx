'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AttendanceActionForm } from '@/components/attendance/action-form'
import { deleteFieldReport } from '@/app/actions/field-reports'

export function DeleteFieldReportButton({ id, version, label }: { id: string; version: number; label: string }) {
  const [open, setOpen] = useState(false), router = useRouter()
  return <><Button variant="outline" size="sm" className="text-red-700" onClick={() => setOpen(true)}>Eliminar reporte de campo</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Eliminar reporte de campo</DialogTitle><DialogDescription>{label}</DialogDescription></DialogHeader>
    <p className="text-sm text-slate-600">Se eliminará el archivo de referencia. Los periodos que lo usaban quedarán pendientes de actualización por RH desde Biochecadores. Esta acción no se puede deshacer.</p>
    <AttendanceActionForm label="Eliminar definitivamente" action={async form => { const result = await deleteFieldReport(form); if (result.success) { setOpen(false); router.push('/field-reports'); router.refresh() } return result }}><input type="hidden" name="reportId" value={id} /><input type="hidden" name="version" value={version} /><label className="block space-y-2 text-sm">Escribe ELIMINAR para confirmar<Input name="confirmation" required pattern="ELIMINAR" autoComplete="off" /></label></AttendanceActionForm>
  </DialogContent></Dialog></>
}
