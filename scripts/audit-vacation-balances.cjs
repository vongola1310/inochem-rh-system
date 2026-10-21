// Auditoría de todos los empleados. La transacción prohíbe escrituras en la base de datos.
const fs = require('node:fs')
const path = require('node:path')
const { PrismaClient, Prisma } = require('@prisma/client')
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'))
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { getCycleBounds } = require('../lib/vacation-cycle.ts')
const { calculateVacationUsage } = require('../lib/vacation-usage.ts')
const db = new PrismaClient()

;(async () => {
  if (process.argv.length > 2) throw new Error('Este script no acepta opciones ni modifica saldos.')
  const asOf = new Date()
  const users = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    return tx.user.findMany({
      orderBy: { employeeNumber: 'asc' },
      select: {
        employeeNumber: true, name: true, role: true, entryDate: true,
        balance: { select: { totalDays: true, usedDays: true, pendingDays: true, lastYearProcessed: true, lastUpdated: true } },
        requests: { where: { type: 'VACATION' }, select: { status: true, startDate: true, daysRequested: true } },
      },
    })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10000, timeout: 60000 })

  const rows = users.map(user => {
    const { cycleStart, cycleEnd } = getCycleBounds(user.entryDate, asOf)
    const yearsCompleted = cycleStart.getUTCFullYear() - user.entryDate.getUTCFullYear()
    const expected = calculateVacationUsage(user.requests, cycleStart, cycleEnd)
    const currentRequests = user.requests.filter(r => r.startDate >= cycleStart && r.startDate < cycleEnd)
    const requestsByStatus = {}
    for (const request of currentRequests) {
      const status = requestsByStatus[request.status] ||= { requests: 0, days: 0 }
      status.requests++
      status.days += request.daysRequested
    }
    const stored = user.balance
    const flags = []
    if (!stored) flags.push('SIN_SALDO')
    else {
      if (stored.usedDays !== expected.usedDays) flags.push('DIFERENCIA_APROBADOS')
      if (stored.pendingDays !== expected.pendingDays) flags.push('DIFERENCIA_PENDIENTES_JEFE')
      if (stored.pendingDays < 0) flags.push('PENDIENTES_NEGATIVOS')
      if (stored.usedDays < 0) flags.push('APROBADOS_NEGATIVOS')
      if (stored.totalDays < 0) flags.push('ASIGNACION_NEGATIVA')
      if (yearsCompleted >= 1 && stored.lastYearProcessed < yearsCompleted) flags.push('RENOVACION_PENDIENTE')
      if (stored.lastYearProcessed > Math.max(0, yearsCompleted)) flags.push('CICLO_ADELANTADO')
    }
    if (currentRequests.some(r => r.daysRequested <= 0)) flags.push('SOLICITUD_SIN_DIAS_POSITIVOS')
    return {
      employeeNumber: user.employeeNumber, name: user.name, role: user.role,
      cycleStart, cycleEnd, yearsCompleted, stored, expectedFromRequests: expected,
      storedAvailableDays: stored ? stored.totalDays - stored.usedDays - stored.pendingDays : null,
      availableDaysFromRequests: stored ? stored.totalDays - expected.usedDays - expected.pendingDays : null,
      requestsByStatus, flags,
    }
  })
  const different = row => row.flags.includes('DIFERENCIA_APROBADOS') || row.flags.includes('DIFERENCIA_PENDIENTES_JEFE')
  const countFlag = flag => rows.filter(row => row.flags.includes(flag)).length
  const summary = {
    totalUsers: rows.length,
    usersWithBalance: rows.filter(row => row.stored).length,
    usersWithoutBalance: countFlag('SIN_SALDO'),
    matchingUsage: rows.filter(row => row.stored && !different(row)).length,
    differingUsage: rows.filter(different).length,
    usedDaysDifferences: countFlag('DIFERENCIA_APROBADOS'),
    pendingDaysDifferences: countFlag('DIFERENCIA_PENDIENTES_JEFE'),
    negativePendingDays: countFlag('PENDIENTES_NEGATIVOS'),
    negativeUsedDays: countFlag('APROBADOS_NEGATIVOS'),
    pendingRenewal: countFlag('RENOVACION_PENDIENTE'),
    aheadOfCurrentCycle: countFlag('CICLO_ADELANTADO'),
    usersFlagged: rows.filter(row => row.flags.length).length,
  }
  const interpretation = 'Comparación de los contadores guardados contra las solicitudes de vacaciones del ciclo vigente. Los días en revisión de RH ya están incluidos en aprobados por jefe. Las diferencias pueden incluir ajustes manuales o historial incompleto; no son todas errores confirmados. Los pendientes negativos sí son inconsistentes. No se modificó ningún dato de la base.'
  const report = { asOf, readOnly: true, interpretation, summary, users: rows }
  const directory = path.resolve(__dirname, '../../diagnosticos')
  fs.mkdirSync(directory, { recursive: true })
  const stem = path.join(directory, 'auditoria-saldos-' + asOf.getTime())
  fs.writeFileSync(stem + '.json', JSON.stringify(report, null, 2), { flag: 'wx' })
  const cell = value => String(value ?? '—').replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ')
  const tableRows = rows.filter(row => row.flags.length).map(row => [
    row.employeeNumber, row.name, row.stored?.usedDays, row.expectedFromRequests.usedDays,
    row.stored?.pendingDays, row.expectedFromRequests.pendingDays, row.expectedFromRequests.pendingHRDays,
    row.flags.join(', '),
  ].map(cell).join(' | '))
  const markdown = [
    '# Auditoría de saldos de vacaciones', '', 'Consulta: ' + asOf.toISOString(), '', interpretation, '',
    `- Usuarios revisados: ${summary.totalUsers}.`,
    `- Con saldo: ${summary.usersWithBalance}; sin saldo: ${summary.usersWithoutBalance}.`,
    `- Contadores coincidentes: ${summary.matchingUsage}; con diferencias: ${summary.differingUsage}.`,
    `- Pendientes negativos: ${summary.negativePendingDays}.`,
    `- Renovaciones pendientes: ${summary.pendingRenewal}.`, '',
    '## Casos para revisión', '',
    '| Empleado | Nombre | Aprobados guardados | Aprobados según solicitudes | Pendientes guardados | Pendientes según solicitudes | En RH (incluidos en aprobados) | Hallazgos |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...tableRows.map(row => '| ' + row + ' |'), '',
    'No se recalcularon asignaciones ni se eliminaron ajustes manuales. El JSON adjunto contiene el resultado de todos los usuarios.', '',
  ].join('\n')
  fs.writeFileSync(stem + '.md', markdown, { flag: 'wx' })
  console.log(JSON.stringify({ asOf, summary, reports: [stem + '.md', stem + '.json'],
    differences: rows.filter(row => row.flags.length).map(({ employeeNumber, stored, expectedFromRequests, flags }) => ({ employeeNumber, stored, expectedFromRequests, flags })),
  }, null, 2))
})().catch(error => {
  console.error('Auditoría no completada:', error.code || error.name)
  process.exitCode = 1
}).finally(() => db.$disconnect())
