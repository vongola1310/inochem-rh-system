'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AttendanceActionForm } from './action-form'
import { deleteAttendancePeriod } from '@/app/actions/delete-attendance-period'

export function DeletePeriodButton({ id, version, label, days }: { id: string; version: number; label: string; days: number }) {
  const [open, setOpen] = useState(false), [confirmation, setConfirmation] = useState('')
  const router = useRouter()
  return <><Button variant="outline" size="sm" className="text-red-700" onClick={() => { setConfirmation(''); setOpen(true) }}>Eliminar periodo</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Eliminar periodo</DialogTitle><DialogDescription>{label}</DialogDescription></DialogHeader>
      <p className="text-sm text-slate-600">Se borrarán este periodo, sus {days} días evaluados, dictámenes y avisos. Dejarán de contar en los reportes mensuales. Esta acción no se puede deshacer.</p>
      <AttendanceActionForm label="Eliminar definitivamente" action={async form => { const result = await deleteAttendancePeriod(form); if (result.success) { setOpen(false); router.push('/admin/attendance'); router.refresh() } return result }}>
        <input type="hidden" name="importId" value={id} /><input type="hidden" name="version" value={version} />
        <label className="block space-y-2 text-sm font-medium">Escribe ELIMINAR para confirmar<Input name="confirmation" required pattern="ELIMINAR" autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
      </AttendanceActionForm>
    </DialogContent></Dialog></>
}
