'use server'

import { PrismaClient, Role } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

const prisma = new PrismaClient()

// 1. ACTUALIZAR DATOS DEL EMPLEADO
export async function updateEmployee(formData: FormData) {
  const id = formData.get('id') as string
  
  // Procesar Fecha de Nacimiento (con corrección de zona horaria)
  const birthDateStr = formData.get('birthDate') as string;
  let birthDateObj = null;
  if (birthDateStr) {
      birthDateObj = new Date(birthDateStr + 'T12:00:00Z');
  }

  const data = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    employeeNumber: formData.get('employeeNumber') as string,
    jobTitle: formData.get('jobTitle') as string,
    bossId: formData.get('bossId') === 'none' ? null : formData.get('bossId') as string,
    role: formData.get('role') as Role,
    // NUEVO CAMPO
    birthDate: birthDateObj,
  }

  // Capturamos los valores de vacaciones
  const totalDays = parseInt(formData.get('totalDays') as string) || 0
  const usedDays = parseInt(formData.get('usedDays') as string) || 0

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: data
      }),
      prisma.vacationBalance.update({
        where: { userId: id },
        data: {
          totalDays: totalDays,
          usedDays: usedDays
        }
      })
    ])

    revalidatePath(`/admin/employees/${id}`)
    revalidatePath('/admin/users')
    return { success: true, message: "Datos actualizados correctamente" }
  } catch (error) {
    console.error(error)
    return { success: false, message: "Error al actualizar." }
  }
}

// 2. ELIMINAR EMPLEADO
export async function deleteEmployee(employeeId: string) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { userId: employeeId } })
      await tx.request.deleteMany({ where: { userId: employeeId } })
      await tx.vacationBalance.deleteMany({ where: { userId: employeeId } })
      
      await tx.user.updateMany({
        where: { bossId: employeeId },
        data: { bossId: null }
      })
      await tx.user.updateMany({
        where: { backupId: employeeId },
        data: { backupId: null }
      })

      await tx.user.delete({ where: { id: employeeId } })
    })
  } catch (error) {
    console.error(error)
    return { success: false, message: "Error al eliminar empleado." }
  }

  redirect('/admin/users')
}