import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📅 Sembrando días festivos...')

  const holidays2025 = [
    { date: new Date('2025-01-01'), name: 'Año Nuevo' },
    { date: new Date('2025-02-03'), name: 'Día de la Constitución (Puente)' },
    { date: new Date('2025-03-17'), name: 'Natalicio de Benito Juárez (Puente)' },
    { date: new Date('2025-05-01'), name: 'Día del Trabajo' },
    { date: new Date('2025-09-16'), name: 'Independencia de México' },
    { date: new Date('2025-11-17'), name: 'Revolución Mexicana (Puente)' },
    { date: new Date('2025-12-25'), name: 'Navidad' },
  ]

  for (const h of holidays2025) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: {}, // Si ya existe, no hace nada
      create: h,
    })
  }

  console.log('✅ Días festivos cargados.')
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error(e); await prisma.$disconnect(); process.exit(1)
  })