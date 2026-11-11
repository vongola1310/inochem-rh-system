'use client'

import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AttendanceActionForm({ action, children, label, navigateOnId, disabled = false, className = '' }: {
  action: (form: FormData) => Promise<{ success: boolean; message: string; id?: string }>
  children: React.ReactNode; label: string; navigateOnId?: string; disabled?: boolean; className?: string
}) {
  const router = useRouter(), lock = useRef(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current || disabled) return
    const data = new FormData(event.currentTarget)
    lock.current = true; setPending(true); setResult(null)
    try {
      const response = await action(data)
      setResult(response)
      if (response.success) {
        if (navigateOnId && response.id) router.push(navigateOnId + response.id)
        else router.refresh()
      }
    } catch { setResult({ success: false, message: 'No se pudo completar la operación. Revisa tu conexión e inténtalo de nuevo.' }) }
    finally { lock.current = false; setPending(false) }
  }
  return <form onSubmit={submit} className={`space-y-4 ${className}`} aria-busy={pending}>
    <fieldset disabled={pending || disabled} className="min-w-0 space-y-4">
      {children}
      <Button type="submit" disabled={pending || disabled} className="h-auto min-h-11 whitespace-normal bg-[#3e712c] text-white hover:bg-[#315a23]">
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{pending ? 'Procesando…' : label}
      </Button>
    </fieldset>
    {result && <p role={result.success ? 'status' : 'alert'} className={`rounded-lg border p-3 text-sm ${result.success ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>{result.message}</p>}
  </form>
}
