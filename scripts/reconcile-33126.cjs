// Reparación acotada al caso revisado. Sin --apply solo consulta; no cambia solicitudes.
const fs = require('node:fs')
const path = require('node:path')
const { PrismaClient, Prisma } = require('@prisma/client')
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'))
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { getCycleBounds } = require('../lib/vacation-cycle.ts')
const { calculateVacationUsage } = require('../lib/vacation-usage.ts')
const db = new PrismaClient()
const apply = process.argv.includes('--apply')
let auditPath
let audit
;(async () => {
  const result = await db.$transaction(async tx => {
    if (!apply) await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    const user = await tx.user.findUnique({
      where: { employeeNumber: '33126' },
      select: { id: true, name: true, employeeNumber: true, entryDate: true,
        balance: { select: { totalDays: true, usedDays: true, pendingDays: true, lastYearProcessed: true, lastUpdated: true } },
        requests: { where: { type: 'VACATION' }, select: { id: true, status: true, startDate: true, daysRequested: true } },
      },
    })
    if (!user?.balance) throw new Error('No se encontró el saldo del empleado 33126.')
    const { cycleStart, cycleEnd } = getCycleBounds(user.entryDate)
    const expected = calculateVacationUsage(user.requests, cycleStart, cycleEnd)
    const before = user.balance
    const alreadyCorrect = before.usedDays === expected.usedDays && before.pendingDays === expected.pendingDays
    audit = { employeeNumber: user.employeeNumber, name: user.name, cycleStart, cycleEnd, before, expected, requestSnapshot: user.requests, status: 'preview' }
    if (apply && !alreadyCorrect) {
      // Evita corregir otro caso o pisar modificaciones posteriores al diagnóstico.
      if (before.totalDays !== 21 || before.usedDays !== 32 || before.pendingDays !== -11 || before.lastYearProcessed !== 3 || expected.usedDays !== 21 || expected.pendingDays !== 0 || expected.pendingHRDays !== 3) {
        throw new Error('Los datos cambiaron desde el diagnóstico. No se realizó ninguna modificación.')
      }
      const auditDir = path.resolve(__dirname, '../../diagnosticos')
      fs.mkdirSync(auditDir, { recursive: true })
      auditPath = path.join(auditDir, 'saldo-33126-' + Date.now() + '.json')
      fs.writeFileSync(auditPath, JSON.stringify({ ...audit, status: 'prepared' }, null, 2), { flag: 'wx' })
      const update = await tx.vacationBalance.updateMany({
        where: { userId: user.id, totalDays: 21, usedDays: 32, pendingDays: -11, lastYearProcessed: 3, lastUpdated: before.lastUpdated },
        data: { usedDays: expected.usedDays, pendingDays: expected.pendingDays, lastUpdated: new Date() },
      })
      if (update.count !== 1) throw new Error('El saldo cambió durante la conciliación. Operación revertida.')
    }
    return { employeeNumber: user.employeeNumber, before, expected, availableDays: before.totalDays - expected.usedDays - expected.pendingDays, applied: apply && !alreadyCorrect, alreadyCorrect }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 })
  if (auditPath) fs.writeFileSync(auditPath, JSON.stringify({ ...audit, status: 'applied', appliedAt: new Date() }, null, 2))
  const verified = await db.user.findUnique({ where: { employeeNumber: '33126' }, select: { balance: { select: { totalDays: true, usedDays: true, pendingDays: true } } } })
  console.log(JSON.stringify({ ...result, verified: verified.balance, auditPath }, null, 2))
})().catch(error => {
  console.error('Conciliación no completada:', error.code || error.message)
  process.exitCode = 1
}).finally(() => db.$disconnect())
