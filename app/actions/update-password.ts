'use server'

import { PrismaClient } from '@prisma/client'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export async function updatePassword(formData: FormData) {
  const session = await auth()
  
  if (!session?.user?.email) {
    return { success: false, message: "No autorizado. Inicia sesión primero." }
  }

  const newPassword = formData.get('newPassword') as string
  
  if (!newPassword || newPassword.length < 6) {
      return { success: false, message: "La contraseña debe tener al menos 6 caracteres." }
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
        where: { email: session.user.email },
        data: { 
            password: hashedPassword,
            // CORRECCIÓN IMPORTANTE:
            // Marcamos que ya cambió su contraseña para bloquear futuros cambios
            passwordChanged: true 
        }
    })
    
    revalidatePath('/profile')
    
    return { success: true, message: "Contraseña actualizada y cuenta asegurada." }
  } catch (error) {
    console.error("Error al cambiar contraseña:", error)
    return { success: false, message: "Ocurrió un error al actualizar la contraseña." }
  }
}