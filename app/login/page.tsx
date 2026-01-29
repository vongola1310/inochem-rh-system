import { signIn } from '@/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { Mail, Lock, AlertCircle, ArrowRight, Shield } from 'lucide-react'
import { LoginButton } from '@/components/auth/login-button'

// CAMBIO: Quitamos Promise y el await
export default async function LoginPage({ 
  searchParams 
}: { 
  searchParams: { error?: string } 
}) {
  const params = searchParams // Acceso directo
  
  const errorMessage = params.error === "CredentialsSignin" 
    ? "Correo o contraseña incorrectos." 
    : ""

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 via-blue-50/30 to-slate-100 p-4 relative overflow-hidden">
      {/* Patrón de fondo mejorado */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080801a_1px,transparent_1px),linear-gradient(to_bottom,#8080801a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      {/* Círculos decorativos animados */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#73C056]/10 to-transparent rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 backdrop-blur-sm bg-white/95 overflow-hidden">
        {/* Borde de gradiente superior */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#73C056] via-blue-500 to-[#73C056]"></div>
        
        <CardHeader className="space-y-6 pb-8 pt-10">
          {/* Logo con contenedor mejorado */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-xs h-20 mb-2 px-4">
              <Image 
                src="/logo.png" 
                alt="Inochem Logo" 
                fill
                className="object-contain drop-shadow-md"
                priority
              />
            </div>
          </div>
          
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#73C056]/10 to-blue-500/10 rounded-full mb-2">
              <Shield className="h-4 w-4 text-[#73C056]" />
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Portal Seguro
              </span>
            </div>
            
            <CardTitle className="text-3xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Bienvenido
            </CardTitle>
           
            <CardDescription className="text-slate-600 text-base font-medium leading-relaxed">
              Sistema de solicitud de vacaciones y permisos<br />
              <span className="text-[#73C056] font-semibold">Euroimmun México</span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pb-8">
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
            className="space-y-6"
          >
            {/* Campo Email mejorado */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 font-semibold text-sm">
                Correo Electrónico
              </Label>
              <div className="relative group">
                <div className="absolute left-3 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-[#73C056] transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="tu.correo@inochem.com"
                  defaultValue="juan.empleado@inochem.com"
                  required
                  className="pl-11 h-12 border-2 border-slate-200 focus:border-[#73C056] focus:ring-2 focus:ring-[#73C056]/20 transition-all duration-200 rounded-xl font-medium"
                />
              </div>
            </div>

            {/* Campo Password mejorado */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-semibold text-sm">
                Contraseña
              </Label>
              <div className="relative group">
                <div className="absolute left-3 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-[#73C056] transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  defaultValue="password123"
                  required
                  className="pl-11 h-12 border-2 border-slate-200 focus:border-[#73C056] focus:ring-2 focus:ring-[#73C056]/20 transition-all duration-200 rounded-xl font-medium"
                />
              </div>
            </div>

            {/* Mensaje de error mejorado */}
            {errorMessage && (
              <div className="bg-gradient-to-r from-red-50 to-red-50/50 border-l-4 border-red-500 text-red-700 p-4 rounded-xl flex items-start gap-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="font-bold text-sm mb-0.5">Error de autenticación</p>
                  <p className="text-sm font-medium">{errorMessage}</p>
                </div>
              </div>
            )}

            <LoginButton />
            
          </form>

          {/* Footer del formulario mejorado */}
          <div className="mt-8 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-500 font-medium">
                  Soporte
                </span>
              </div>
            </div>
            
            <div className="text-center bg-slate-50 rounded-lg p-3 border border-slate-100">
              <p className="text-xs text-slate-600 font-medium">
                ¿Problemas para acceder?
              </p>
              <p className="text-xs text-[#73C056] font-semibold mt-1">
                Contacta a Recursos Humanos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer mejorado */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-slate-200">
          <p className="text-xs text-slate-500 font-medium">
            © 2025 Euroimmun • Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  )
}