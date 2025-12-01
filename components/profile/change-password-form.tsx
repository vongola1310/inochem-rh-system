'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { updatePassword } from '@/app/actions/update-password'
import { toast } from "sonner"
import { Lock, CheckCircle, ShieldCheck } from 'lucide-react'

export function ChangePasswordForm({ isPasswordChanged }: { isPasswordChanged: boolean }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    const res = await updatePassword(formData)
    setLoading(false)
    
    if (res.success) {
        toast.success("Éxito", { description: res.message })
        // Recargar la página para mostrar el estado bloqueado
        window.location.reload()
    } else {
        toast.error("Error", { description: res.message })
    }
  }

  // ESTADO 1: SI YA LA CAMBIÓ, MOSTRAMOS MENSAJE DE ÉXITO Y BLOQUEAMOS
  if (isPasswordChanged) {
    return (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-green-600" />
            </div>
            <div>
                <h3 className="text-lg font-semibold text-slate-900">Cuenta Segura</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">
                    Ya has actualizado tu contraseña personal.
                </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600">
                Si olvidaste tu clave, contacta al departamento de RH para un reseteo manual.
            </div>
        </div>
    )
  }

  // ESTADO 2: SI NO LA HA CAMBIADO, MOSTRAMOS EL FORMULARIO
  return (
    <form action={handleSubmit} className="space-y-4">
        <div className="p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-md mb-4">
            <p className="text-xs text-amber-800 font-medium">
                Acción Requerida: Por seguridad, debes cambiar tu contraseña temporal (Número de Empleado) por una personal.
            </p>
        </div>

        <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Nueva Contraseña</label>
            <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400"/>
                <Input 
                    name="newPassword" 
                    type="password" 
                    placeholder="Mínimo 6 caracteres" 
                    className="pl-10 border-slate-300"
                    required 
                    minLength={6}
                />
            </div>
        </div>
        <Button className="w-full bg-slate-900 hover:bg-slate-800" disabled={loading}>
            {loading ? "Guardando..." : "Establecer Contraseña"}
        </Button>
    </form>
  )
}