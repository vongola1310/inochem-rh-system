'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const prisma = new PrismaClient()

// 1. ACTUALIZAR DATOS DEL EMPLEADO
export async function updateEmployee(formData: FormData) {
  const id = formData.get('id') as string
  
  const data = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    employeeNumber: formData.get('employeeNumber') as string,
    jobTitle: formData.get('jobTitle') as string,
    // Si el jefe es "none", lo ponemos en null
    bossId: formData.get('bossId') === 'none' ? null : formData.get('bossId') as string,
  }

  try {
    await prisma.user.update({
      where: { id },
      data: data
    })

    revalidatePath(`/admin/employees/${id}`)
    revalidatePath('/admin/users')
    return { success: true, message: "Datos actualizados correctamente" }
  } catch (error) {
    return { success: false, message: "Error al actualizar. Verifica si el correo ya existe." }
  }
}

// 2. ELIMINAR EMPLEADO (Baja definitiva)
export async function deleteEmployee(employeeId: string) {
  try {
    // Usamos una transacción para borrar todo lo relacionado primero
    await prisma.$transaction(async (tx) => {
      // 1. Borrar notificaciones donde él aparece
      await tx.notification.deleteMany({ where: { userId: employeeId } })
      
      // 2. Borrar solicitudes de vacaciones
      await tx.request.deleteMany({ where: { userId: employeeId } })
      
      // 3. Borrar saldo
      await tx.vacationBalance.deleteMany({ where: { userId: employeeId } })

      // 4. Desvincular subordinados (si era jefe, sus empleados se quedan sin jefe momentáneamente)
      await tx.user.updateMany({
        where: { bossId: employeeId },
        data: { bossId: null }
      })

      // 5. FINALMENTE borrar el usuario
      await tx.user.delete({ where: { id: employeeId } })
    })
  } catch (error) {
    console.error(error)
    return { success: false, message: "Error al eliminar empleado." }
  }

  // Redirigir al directorio porque la página del empleado ya no existe
  redirect('/admin/users')
}