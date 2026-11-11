// Migración aditiva para la base existente; sin --apply <hash> es solo lectura.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict')
const { PrismaClient } = require('@prisma/client')
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'))
const db = new PrismaClient(), schema = new URL(process.env.DATABASE_URL).searchParams.get('schema') || 'public'
assert.match(schema, /^[a-zA-Z_][a-zA-Z0-9_]*$/)
const tables = ['FieldReport', 'FieldReportDay', 'FieldReportSchedule']
const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/202610280001_field_reports/migration.sql'), 'utf8')
const hash = crypto.createHash('sha256').update(sql).digest('hex')
const statements = sql.split(';').map(s => s.trim()).filter(Boolean)
for (const statement of statements) {
  const table = statement.match(/^(?:CREATE TABLE|ALTER TABLE) "([^"]+)"/)
  const index = statement.match(/^CREATE (?:UNIQUE )?INDEX "[^"]+" ON "([^"]+)"/)
  assert.ok((table && tables.includes(table[1])) || (index && tables.includes(index[1])) || statement === 'ALTER TABLE "User" ADD COLUMN "canUploadFieldReports" BOOLEAN NOT NULL DEFAULT false')
  assert.ok(!/\b(DROP|DELETE|TRUNCATE|UPDATE|INSERT)\b/.test(statement.replace(/ON UPDATE CASCADE/g, '').replace(/ON DELETE RESTRICT/g, '')))
}
const firstDue = '2026-10-28' // Fecha acordada para la activación del módulo.
async function main() {
  const apply = process.argv[2] === '--apply'
  if (apply) assert.equal(process.argv[3], hash)
  const result = await db.$transaction(async tx => {
    if (!apply) await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`)
    const currentTables = await tx.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema=${schema} AND table_name IN ('FieldReport','FieldReportDay','FieldReportSchedule')`
    const columns = await tx.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema=${schema} AND table_name='User' AND column_name='canUploadFieldReports'`
    const uploader = await tx.$queryRaw`SELECT id, name, "employeeNumber", "isBlacklisted" FROM "User" WHERE "employeeNumber"='33028'`
    assert.equal(uploader.length, 1, 'Debe identificarse un único responsable')
    assert.equal(uploader[0].name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(), 'PANDO MORALES GIBRAN')
    assert.equal(uploader[0].isBlacklisted, false)
    const snapshot = () => tx.$queryRawUnsafe(`SELECT to_jsonb(u) - 'canUploadFieldReports' AS record FROM "${schema}"."User" u ORDER BY id`)
    const before = await snapshot()
    const counts = {}
    for (const table of ['AttendanceImport','AttendanceDay','Request','MedicalLeave','Notification']) counts[table] = (await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${schema}"."${table}"`))[0].n
    if (!apply) return { mode: 'READ_ONLY', hash, existingTables: currentTables.length, existingColumn: columns.length, uploader: { name: uploader[0].name, employeeNumber: uploader[0].employeeNumber }, counts }
    assert.equal(currentTables.length, 0); assert.equal(columns.length, 0)
    for (const statement of statements) await tx.$executeRawUnsafe(statement)
    await tx.$executeRaw`UPDATE "User" SET "canUploadFieldReports"=true WHERE id=${uploader[0].id}`
    await tx.$executeRaw`INSERT INTO "FieldReportSchedule" ("userId", "nextDueDate", "updatedAt") VALUES (${uploader[0].id}, ${new Date(firstDue + 'T00:00:00Z')}, CURRENT_TIMESTAMP)`
    assert.deepEqual(await snapshot(), before)
    for (const table of Object.keys(counts)) assert.equal((await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${schema}"."${table}"`))[0].n, counts[table])
    assert.equal((await tx.$queryRawUnsafe('SELECT count(*)::int AS n FROM "User" WHERE "canUploadFieldReports"=true'))[0].n, 1)
    return { mode: 'ACTIVATED', hash, usersPreserved: before.length, uploaderEmployeeNumber: '33028', firstDue, existingRecordsUnchanged: counts }
  }, { isolationLevel: 'Serializable', timeout: 30000 })
  console.log(JSON.stringify(result))
}
main().catch(e => { console.error('Activación interrumpida:', e.code || e.message); process.exitCode = 1 }).finally(() => db.$disconnect())
