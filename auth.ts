import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaClient } from "@prisma/client"
import { z } from "zod"
import bcrypt from "bcryptjs" // <--- Importamos bcrypt

const prisma = new PrismaClient()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      authorize: async (credentials) => {
        try {
          const { email, password } = await loginSchema.parseAsync(credentials)
          
          const user = await prisma.user.findUnique({
            where: { email },
          })

          if (!user) return null

          // LÓGICA DE SEGURIDAD HÍBRIDA
          // 1. Intentamos verificar si es un Hash seguro
          let isValid = await bcrypt.compare(password, user.password);

          // 2. FALLBACK: Si falló, verificamos si es una contraseña vieja (texto plano)
          // Esto permite que los usuarios existentes sigan entrando hasta que cambien su clave.
          if (!isValid && user.password === password) {
             isValid = true;
          }

          if (!isValid) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }

        } catch (error) {
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