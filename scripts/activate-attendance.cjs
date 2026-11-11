// Migración aditiva y explícita para una base existente sin baseline de Prisma.
// Sin --apply <sha256>, solo inspecciona el estado y muestra el hash del SQL.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { PrismaClient, Prisma } = require('@prisma/client')
const root = path.resolve(__dirname, '..')
require('@next/env').loadEnvConfig(root)
const db = new PrismaClient()
const tables = ['MedicalLeave', 'AttendanceImport', 'AttendanceDay', 'AttendanceEvent']
const enums = ['MedicalLeaveKind', 'AttendanceImportStatus', 'AttendanceReviewStatus', 'AttendanceDecision']
const schema = new URL(process.env.DATABASE_URL).searchParams.get('schema') || 'public'
assert.match(schema, /^[a-zA-Z_][a-zA-Z0-9_]*$/)
const sql = fs.readFileSync(path.join(root, 'prisma/migrations/202610260001_attendance/migration.sql'), 'utf8')
const hash = crypto.createHash('sha256').update(sql).digest('hex')
const statements = sql.split(';').map(s => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)
for (const statement of statements) {
  const createType = statement.match(/^CREATE TYPE "([^"]+)" AS ENUM /)
  const table = statement.match(/^(?:CREATE TABLE|ALTER TABLE) "([^"]+)" /)
  const index = statement.match(/^CREATE (?:UNIQUE )?INDEX "[^"]+" ON "([^"]+)"/)
  assert.ok((createType && enums.includes(createType[1])) || (table && tables.includes(table[1])) || (index && tables.includes(index[1])) || statement === 'ALTER TYPE "RequestType" ADD VALUE \'PERMIT_HOME_OFFICE\'', 'SQL fuera del alcance aditivo aprobado')
  assert.ok(!/\b(DROP|DELETE|TRUNCATE|UPDATE|INSERT)\b/.test(statement.replace(/ON UPDATE CASCADE/g, '').replace(/ON DELETE RESTRICT/g, '')), 'Operación no permitida')
}
async function state(tx) {
  const existing = await tx.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = ${schema}`
  const types = await tx.$queryRaw`SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=${schema}`
  const homeOffice = await tx.$queryRaw`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=${schema} AND t.typname='RequestType' AND e.enumlabel='PERMIT_HOME_OFFICE'`
  return { tables: tables.filter(name => existing.some(row => row.table_name === name)), enums: enums.filter(name => types.some(row => row.typname === name)), homeOffice: homeOffice.length === 1 }
}
async function counts(tx) {
  const result = {}
  for (const name of ['User', 'Request', 'VacationBalance', 'Notification', 'Holiday']) {
    const rows = await tx.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "${schema}"."${name}"`)
    result[name] = rows[0].count
  }
  return result
}
async function main() {
  const apply = process.argv[2] === '--apply'
  if (apply) assert.equal(process.argv[3], hash, 'El hash aprobado no coincide con el SQL actual')
  const result = await db.$transaction(async tx => {
    if (!apply) await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`)
    assert.equal((await tx.$queryRawUnsafe('SELECT current_schema() AS name'))[0].name, schema)
    const before = await state(tx), originalCounts = await counts(tx)
    if (!apply) return { mode: 'READ_ONLY', migrationSha256: hash, state: before, existingRecords: originalCounts }
    assert.equal(before.tables.length, 0, 'Ya existen tablas de asistencia; no se aplicará de nuevo ni parcialmente')
    assert.equal(before.enums.length, 0, 'Ya existen tipos de asistencia; revisar estado antes de continuar')
    assert.equal(before.homeOffice, false, 'Home Office ya existe; revisar estado antes de continuar')
    for (const statement of statements) await tx.$executeRawUnsafe(statement)
    const after = await state(tx)
    assert.equal(after.tables.length, 4)
    assert.equal(after.enums.length, 4)
    assert.equal(after.homeOffice, true)
    assert.deepEqual(await counts(tx), originalCounts, 'Los registros anteriores deben permanecer intactos')
    for (const name of tables) assert.equal((await tx.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "${schema}"."${name}"`))[0].count, 0)
    return { mode: 'ACTIVATED', migrationSha256: hash, state: after, existingRecordsUnchanged: originalCounts, newTablesEmpty: true }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60000 })
  console.log(JSON.stringify(result, null, 2))
}
main().catch(error => { console.error('Activación interrumpida:', error.code || error.message); process.exitCode = 1 }).finally(() => db.$disconnect())
