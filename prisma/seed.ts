import { PrismaClient, Role } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando sembrado de datos (Solo RH)...')

  // Crear al usuario MAESTRO de RECURSOS HUMANOS
  // Este es el único necesario para arrancar el sistema
  await prisma.user.upsert({
    where: { email: 'rh@inochem.com' },
    update: {},
    create: {
      name: 'Lic. Recursos Humanos',
      email: 'rh@inochem.com',
      password: 'admin', // Contraseña inicial
      role: Role.HR,
      jobTitle: 'Gerente de Capital Humano',
      
      // NUEVOS CAMPOS OBLIGATORIOS (Para que no falle la BD)
      employeeNumber: 'RH001', 
      entryDate: new Date('2015-01-01'), // Fecha antigua simbólica
      
      // Saldo inicial (RH puede editarlo después si lo necesita)
      balance: {
        create: {
            totalDays: 0, 
            usedDays: 0,
            pendingDays: 0
        }
      }
    },
  })

  console.log('✅ Usuario RH creado con éxito:')
  console.log('   User: rh@inochem.com')
  console.log('   Pass: admin')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })