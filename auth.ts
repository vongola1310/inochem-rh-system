import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma" // Singleton
import { z } from "zod"
import bcrypt from "bcryptjs"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      authorize: async (credentials) => {
        try {
          console.log(`[AUTH] Intento de login para: ${credentials?.email}`);
          
          const { email, password } = await loginSchema.parseAsync(credentials)
          
          console.log("[AUTH] Conectando a Base de Datos...");
          const user = await prisma.user.findUnique({
            where: { email },
          })

          if (!user) {
            console.log("[AUTH] ❌ Usuario no encontrado en la base de datos.");
            return null
          }

          console.log("[AUTH] Usuario encontrado. Verificando contraseña...");

          // 1. Verificación Hash (Bcrypt)
          let isValid = await bcrypt.compare(password, user.password);

          // 2. Verificación Fallback (Texto Plano - Contraseñas viejas)
          if (!isValid && user.password === password) {
             console.log("[AUTH] ⚠️ Contraseña válida (Formato antiguo/texto plano).");
             isValid = true;
          }

          if (!isValid) {
             console.log("[AUTH] ❌ Contraseña incorrecta.");
             return null;
          }

          console.log("[AUTH] ✅ Credenciales válidas. Iniciando sesión.");
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }

        } catch (error) {
          console.error("[AUTH] 🔥 Error CRÍTICO en authorize:", error);
          // Si el error es de conexión, lo veremos aquí
          return null
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
        (session.user as any).role = (token as any).role
      }
      return session
    },
    async jwt({ token, user }) {
        if (user) {
            token.role = (user as any).role
        }
        return token
    }
  },
})