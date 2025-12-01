'use server'

import { PrismaClient, Role } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { differenceInYears } from 'date-fns'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Esquema de validación CORREGIDO - acepta null, string vacío, o undefined
const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  employeeNumber: z.string().min(1),
  jobTitle: z.string().min(2),
  entryDate: z.string(),
  birthDate: z.string().nullable().transform(val => {
    if (!val || val === '') return undefined
    return val
  }).optional(),
  bossId: z.string().nullable().transform(val => {
    // Convertir null, strings vacíos o "none" a undefined
    if (!val || val === '' || val === 'none') return undefined
    return val
  }).optional(),
  role: z.enum(['EMPLOYEE', 'ADMIN', 'HR']),
  manualBalance: z.coerce.number().min(0), 
})

export async function registerEmployee(formData: FormData) {
  try {
    // 1. Recopilar datos del formulario
    const rawBossId = formData.get('bossId')
    
    const rawData = {
      name: formData.get('name'),
      email: formData.get('email'),
      employeeNumber: formData.get('employeeNumber'),
      jobTitle: formData.get('jobTitle'),
      entryDate: formData.get('entryDate'),
      birthDate: formData.get('birthDate'),
      bossId: rawBossId,
      role: formData.get('role'),
      manualBalance: formData.get('manualBalance'),
    }

    console.log('📋 Datos recibidos:', rawData)

    const data = registerSchema.parse(rawData)
    
    console.log('✅ Datos validados:', data)
    
    // 2. VALIDAR QUE EL JEFE EXISTE (si se proporcionó)
    if (data.bossId) {
      const bossExists = await prisma.user.findUnique({
        where: { id: data.bossId }
      })
      
      if (!bossExists) {
        console.error('❌ Jefe no existe:', data.bossId)
        return { success: false, message: 'El jefe seleccionado no existe en el sistema.' }
      }
      console.log('✅ Jefe validado:', bossExists.name)
    } else {
      console.log('ℹ️ Sin jefe asignado (Director)')
    }
    
    // 3. CORRECCIÓN DE ZONA HORARIA PARA FECHA DE INGRESO
    const entryDateObj = new Date(data.entryDate + 'T12:00:00Z')
    
    // 4. PROCESAR FECHA DE CUMPLEAÑOS (Si existe)
    let birthDateObj = null
    if (data.birthDate && data.birthDate.trim() !== '') {
        birthDateObj = new Date(data.birthDate + 'T12:00:00Z')
    }

    // 5. SINCRONIZACIÓN DE ANTIGÜEDAD
    const currentYearsWorked = differenceInYears(new Date(), entryDateObj)

    // 6. CIFRADO DE CONTRASEÑA
    const hashedPassword = await bcrypt.hash(data.employeeNumber, 10)

    // 7. CREACIÓN EN BASE DE DATOS
    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        employeeNumber: data.employeeNumber,
        password: hashedPassword,
        jobTitle: data.jobTitle,
        entryDate: entryDateObj,
        birthDate: birthDateObj,
        role: data.role as Role,
        bossId: data.bossId || null,
        
        balance: {
          create: {
            totalDays: data.manualBalance, 
            usedDays: 0,
            pendingDays: 0,
            lastYearProcessed: currentYearsWorked 
          }
        }
      }
    })

    console.log('🎉 Usuario creado:', newUser.name)

    revalidatePath('/admin/users')
    return { success: true, message: 'Empleado registrado correctamente.' }

  } catch (error: any) {
    console.error('❌ Error completo:', error)
    
    // Manejo de errores más específico
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'campo'
      return { success: false, message: `El ${field} ya está registrado en el sistema.` }
    }
    
    if (error.code === 'P2003') {
      return { success: false, message: 'Error: El jefe seleccionado no es válido.' }
    }
    
    if (error.name === 'ZodError') {
      const messages = error.errors?.map((e: any) => e.message).join(', ') || 'Error de validación'
      return { success: false, message: `Validación: ${messages}` }
    }
    
    return { success: false, message: `Error al registrar empleado: ${error.message || 'Intenta nuevamente.'}` }
  }
}