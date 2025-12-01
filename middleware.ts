import { auth } from "@/auth"

// En v5, la función 'auth' ya actúa como middleware por defecto
export default auth

export const config = {
  // Aquí definimos en qué rutas se ejecuta el middleware
  // Excluimos archivos estáticos y rutas de API internas para mejor rendimiento
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}