import { PrismaClient } from '@prisma/client'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { UserCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
// Importamos el componente cliente que maneja la lógica visual
import { ChangePasswordForm } from '@/components/profile/change-password-form'

const prisma = new PrismaClient()

export default async function ProfilePage() {
  const session = await auth()
  
  // Seguridad: Si no hay sesión, mandar al login
  if (!session?.user?.email) {
    redirect('/login')
  }

  // Consultamos el estado de la contraseña en la base de datos
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { passwordChanged: true }
  })

  if (!user) return <div className="p-8 text-red-500">Error: Usuario no encontrado.</div>

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">
        
        {/* Botón para volver al inicio */}
        <div className="w-full max-w-md mb-6">
            <Link href="/">
                <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-blue-600 gap-2">
                    <ArrowLeft className="h-4 w-4" /> Volver al Inicio
                </Button>
            </Link>
        </div>

        <Card className="w-full max-w-md shadow-lg border-slate-200">
            <CardHeader className="bg-slate-100 border-b border-slate-200">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                    <UserCircle className="h-6 w-6 text-blue-600"/> Mi Perfil
                </CardTitle>
                <CardDescription>Gestiona la seguridad de tu cuenta</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                {/* Renderizamos el formulario cliente pasándole el estado actual */}
                <ChangePasswordForm isPasswordChanged={user.passwordChanged} />
            </CardContent>
        </Card>
    </div>
  )
}