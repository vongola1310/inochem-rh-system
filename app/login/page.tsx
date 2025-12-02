import { signIn } from '@/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { Mail, Lock, AlertCircle } from 'lucide-react'
// 1. IMPORTAMOS EL NUEVO BOTÓN
import { LoginButton } from '@/components/auth/login-button'

export default async function LoginPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ error?: string }> 
}) {
  const params = await searchParams
  
  const errorMessage = params.error === "CredentialsSignin" 
    ? "Correo o contraseña incorrectos." 
    : ""

  return (
    <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-slate-100 via-slate-50 to-slate-100 p-4">
      {/* Patrón de fondo sutil */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]"></div>
      
      <Card className="w-full max-w-md relative z-10 shadow-xl border-slate-200">
        <CardHeader className="space-y-4 pb-8">
          {/* Logo Grande */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-xs h-16 mb-4">
              <Image 
                src="/logo.png" 
                alt="Inochem Logo" 
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
          
          {/* Títulos */}
          <div className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold text-slate-900">
              
            </CardTitle>
           
            <CardDescription className="text-slate-600 text-base">
              Sistema de Solicitud y seguimiento de Vacaciones<br />euroimmun México
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form
            action={async (formData) => {
              "use server"
              try {
                await signIn("credentials", {
                  email: formData.get("email"),
                  password: formData.get("password"),
                  redirectTo: "/",
                })
              } catch (error) {
                if (error instanceof AuthError) {
                  switch (error.type) {
                    case "CredentialsSignin":
                      return redirect("/login?error=CredentialsSignin")
                    default:
                      return redirect("/login?error=Default")
                  }
                }
                throw error
              }
            }}
            className="space-y-5"
          >
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-medium">
                Correo Electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="tu.correo@inochem.com"
                  defaultValue="juan.empleado@inochem.com"
                  required
                  className="pl-10 h-11 border-slate-300 focus:border-[#73C056] focus:ring-[#73C056] transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  defaultValue="password123"
                  required
                  className="pl-10 h-11 border-slate-300 focus:border-[#73C056] focus:ring-[#73C056] transition-colors"
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-md flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Error de autenticación</p>
                  <p className="text-sm">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* 2. REEMPLAZAMOS EL BOTÓN NORMAL POR EL COMPONENTE CLIENTE */}
            <LoginButton />
            
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              ¿Problemas para acceder? Contacta a Recursos Humanos
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer absoluto */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-xs text-slate-400">
          © 2025 eruoimmun. Todos los derechos reservados.
        </p>
      </div>
    </div>
  )
}