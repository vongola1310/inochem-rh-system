'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export function LoginButton() {
  const { pending } = useFormStatus()

  return (
    <Button 
      type="submit" 
      disabled={pending}
      className="w-full h-12 bg-[#73C056] hover:bg-[#62a847] text-white font-semibold text-base transition-all duration-200 shadow-md hover:shadow-lg mt-6 disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Verificando...
        </>
      ) : (
        "Iniciar Sesión"
      )}
    </Button>
  )
}