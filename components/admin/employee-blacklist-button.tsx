'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { setEmployeeBlacklist } from '@/app/actions/employee-blacklist'

export function EmployeeBlacklistButton({ employee }: { employee: { id: string; name: string; isBlacklisted: boolean } }) {
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [message, setMessage] = useState('')
  const router = useRouter()
  async function submit() {
    if (pending) return
    setPending(true); setMessage('')
    try {
      const data = new FormData()
      data.set('userId', employee.id); data.set('blacklisted', String(!employee.isBlacklisted))
      const result = await setEmployeeBlacklist(data)
      if (result.success) { setOpen(false); router.refresh() } else setMessage(result.message)
    } catch { setMessage('No se pudo guardar. Inténtalo de nuevo.') }
    finally { setPending(false) }
  }
  return <>
    <Button size="sm" variant="outline" onClick={() => { setMessage(''); setOpen(true) }}>{employee.isBlacklisted ? 'Restaurar colaborador' : 'Enviar a lista negra'}</Button>
    <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value) }}><DialogContent>
      <DialogHeader><DialogTitle>{employee.isBlacklisted ? 'Restaurar colaborador' : 'Enviar a lista negra'}</DialogTitle><DialogDescription>{employee.name}</DialogDescription></DialogHeader>
      <p className="text-sm text-slate-600">{employee.isBlacklisted ? 'Volverá a participar en incidencias. RH deberá actualizar los periodos afectados.' : 'Se conservarán sus datos y su historial. Dejará de aparecer en incidencias, reportes y nuevos periodos de asistencia. RH deberá actualizar los periodos afectados.'}</p>
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={pending} onClick={submit}>{pending ? 'Guardando…' : 'Confirmar'}</Button></div>
    </DialogContent></Dialog>
  </>
}
