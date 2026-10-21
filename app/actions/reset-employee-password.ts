'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { canManageEmployees } from '@/lib/employee-access'
import { prisma } from '@/lib/prisma'

export async function resetEmployeePassword(formData: FormData) {
  try {
    if (!await canManageEmployees()) {
      return { success: false, message: 'No tienes permiso para restablecer contraseñas de usuarios.' }
    }

    const employeeId = formData.get('employeeId')
    const newPassword = formData.get('newPassword')
    const confirmPassword = formData.get('confirmPassword')
    if (typeof employeeId !== 'string' || !employeeId.trim()) {
      return { success: false, message: 'Selecciona un empleado válido.' }
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8 || !newPassword.trim()) {
      return { success: false, message: 'La contraseña temporal debe tener al menos 8 caracteres.' }
    }
    // bcrypt solo considera los primeros 72 bytes; rechazar evita contraseñas truncadas.
    if (new TextEncoder().encode(newPassword).length > 72) {
      return { success: false, message: 'La contraseña es demasiado larga. Usa menos caracteres.' }
    }
    if (newPassword !== confirmPassword) {
      return { success: false, message: 'Las contraseñas no coinciden.' }
    }

    const password = await bcrypt.hash(newPassword, 10)
    const result = await prisma.user.updateMany({
      where: { id: employeeId },
      data: { password, passwordChanged: false },
    })
    if (result.count !== 1) {
      return { success: false, message: 'El empleado ya no existe. Actualiza el directorio e inténtalo de nuevo.' }
    }

    revalidatePath(`/admin/employees/${employeeId}`)
    revalidatePath('/profile')
    return { success: true, message: 'Contraseña restablecida. Comparte la clave temporal con el usuario para que entre y la cambie en Mi Perfil.' }
  } catch {
    // No registrar el formulario, la clave ni errores que puedan contener datos sensibles.
    return { success: false, message: 'No se pudo restablecer la contraseña. Inténtalo de nuevo.' }
  }
}
