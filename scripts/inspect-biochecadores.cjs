const fs = require('node:fs')
const path = require('node:path')
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'))
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { parseBiocheckFile } = require('../lib/attendance/parser.ts')
const { buildPreview } = require('../lib/attendance/engine.ts')
const { PrismaClient, Prisma } = require('@prisma/client')
const db = new PrismaClient()
;(async () => {
  const start = '2026-09-22', end = '2026-10-06'
  const sources = [['AJUSCO', 'Ajusco 22Sep-06Oct 2026.csv'], ['PERIFERICO', 'Periférico 22Sep-06Oct 2026.csv']]
    .map(([site, name]) => parseBiocheckFile(fs.readFileSync(path.join('C:/Users/PAlvaro/Downloads', name)), name, site, start, end))
  const context = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    const employees = await tx.user.findMany({ select: { id: true, name: true, employeeNumber: true, entryDate: true, bossId: true }, orderBy: { employeeNumber: 'asc' } })
    const requests = await tx.request.findMany({ where: { startDate: { lte: new Date(end + 'T23:59:59Z') } }, select: { id: true, userId: true, type: true, status: true, approvedByBoss: true, startDate: true, returnDate: true, endDate: true, permitTime: true } })
    const holidays = (await tx.holiday.findMany({ select: { date: true } })).map(h => h.date.toISOString().slice(0, 10))
    return { employees, requests, holidays }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 })
  const preview = buildPreview({ start, end, sources, ...context, leaves: [], config: { includedUserIds: context.employees.map(e => e.id), excludedUsers: {}, mappings: {}, reviewers: {} } })
  const summary = { readOnly: true, sources: sources.map(({ site, rowCount, duplicateCount, people, punches, warnings }) => ({ site, rows: rowCount, people: people.length, punches: punches.length, duplicateCount, warnings })),
    unresolved: preview.identities.filter(i => !i.userId), errors: preview.errors,
    days: preview.days.length, automaticExits: preview.days.filter(d => d.exitEstimated).length,
    provisionalIssues: Object.fromEntries(['ABSENCE', 'LATE', 'EARLY_EXIT', 'MISSING_ENTRY', 'PERMISSION_REVIEW'].map(issue => [issue, preview.days.filter(d => d.detectedIssues.includes(issue)).length])),
    coveredDays: preview.days.filter(d => d.coverage.length).length,
    caution: 'Diagnóstico provisional, incluye todas las cuentas existentes. RH debe confirmar padrón y responsables; no se enviaron incidencias ni se modificó la base.' }
  const dir = path.resolve(__dirname, '../../diagnosticos')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'biochecadores-20261023.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
})().catch(error => { console.error('Diagnóstico:', error.code || error.message); process.exitCode = 1 }).finally(() => db.$disconnect())
