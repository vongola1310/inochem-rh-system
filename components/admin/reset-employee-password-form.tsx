'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Eye, EyeOff, KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { resetEmployeePassword } from '@/app/actions/reset-employee-password'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ResetEmployeePasswordForm({ employeeId }: { employeeId: string }) {
  const submitting = useRef(false)
  const [isPending, setIsPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const form = event.currentTarget
    const data = new FormData(form)
    if (data.get('newPassword') !== data.get('confirmPassword')) {
      setResult({ success: false, message: 'Las contraseñas no coinciden.' })
      return
    }
    submitting.current = true
    setIsPending(true)
    setResult(null)
    try {
      const response = await resetEmployeePassword(data)
      setResult(response)
      if (response.success) {
        form.reset()
        setShowPassword(false)
      }
    } catch {
      setResult({ success: false, message: 'No se pudo completar la operación. Revisa tu conexión e inténtalo de nuevo.' })
    } finally {
      submitting.current = false
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 py-4" aria-busy={isPending}>
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-center gap-2 font-medium text-blue-900">
          <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
          Restablecer contraseña
        </div>
        <p className="mt-2 text-sm leading-relaxed text-blue-800">
          Asigna una clave temporal si el usuario olvidó su contraseña. Después de entrar,
          podrá cambiarla por una personal en <strong>Mi Perfil</strong>.
        </p>
      </div>

      <fieldset disabled={isPending} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="employee-new-password">Nueva contraseña temporal</Label>
          <div className="relative">
            <Input id="employee-new-password" name="newPassword" type={showPassword ? 'text' : 'password'}
              autoComplete="new-password" required minLength={8} maxLength={72} className="pr-12"
              aria-describedby="employee-password-help" onChange={() => setResult(null)} />
            <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-9 w-10 text-slate-500"
              onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword}
              aria-label={showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p id="employee-password-help" className="text-xs text-slate-500">Mínimo 8 caracteres. La clave anterior dejará de funcionar.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="employee-confirm-password">Confirmar contraseña temporal</Label>
          <Input id="employee-confirm-password" name="confirmPassword" type={showPassword ? 'text' : 'password'}
            autoComplete="new-password" required minLength={8} maxLength={72} onChange={() => setResult(null)} />
        </div>
        <Button type="submit" disabled={isPending} className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto">
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />}
          {isPending ? 'Restableciendo...' : 'Restablecer contraseña'}
        </Button>
      </fieldset>

      {result && (
        <div role={result.success ? 'status' : 'alert'}
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${result.success ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {result.success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          <p>{result.message}</p>
        </div>
      )}
    </form>
  )
}
