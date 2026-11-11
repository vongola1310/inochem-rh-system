// Sin --apply <hash> solo consulta el estado. No modifica usuarios ni dictámenes.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict')
const { PrismaClient } = require('@prisma/client')
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'))
const db = new PrismaClient(), schema = new URL(process.env.DATABASE_URL).searchParams.get('schema') || 'public'
assert.match(schema, /^[a-zA-Z_][a-zA-Z0-9_]*$/)
const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/202610290001_reduced_workdays/migration.sql'), 'utf8')
const hash = crypto.createHash('sha256').update(sql).digest('hex')
const statements = sql.split(';').map(statement => statement.trim()).filter(Boolean)
assert.equal(statements.length, 3)
assert.match(statements[0], /^CREATE TABLE "ReducedWorkday"/)
assert.match(statements[1], /^CREATE INDEX "ReducedWorkday_startDate_endDate_idx" ON "ReducedWorkday"/)
assert.equal(statements[2], 'ALTER TYPE "AttendanceDecision" ADD VALUE \'INCIDENT\'')
assert.ok(!/\b(DROP|DELETE|TRUNCATE|INSERT|UPDATE)\b/.test(sql))
async function main() {
  const apply = process.argv[2] === '--apply'
  if (apply) assert.equal(process.argv[3], hash)
  const result = await db.$transaction(async tx => {
    if (!apply) await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`)
    const tables = await tx.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema=${schema} AND table_name='ReducedWorkday'`
    const labels = await tx.$queryRaw`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=${schema} AND t.typname='AttendanceDecision' AND e.enumlabel='INCIDENT'`
    if (!apply) return { mode: 'READ_ONLY', hash, existingTable: tables.length, existingDecision: labels.length }
    assert.equal(tables.length, 0); assert.equal(labels.length, 0)
    const snapshot = async () => {
      const result = {}
      for (const table of ['User', 'Request', 'MedicalLeave', 'AttendanceDay', 'FieldReport', 'Notification']) {
        result[table] = (await tx.$queryRawUnsafe(`SELECT count(*)::int AS n, md5(COALESCE(string_agg(to_jsonb(t)::text, '' ORDER BY id), '')) AS digest FROM "${schema}"."${table}" t`))[0]
      }
      return result
    }
    const before = await snapshot()
    for (const statement of statements) await tx.$executeRawUnsafe(statement)
    const pending = await tx.$executeRawUnsafe('UPDATE "AttendanceImport" SET "needsRefresh"=true WHERE status IN (\'PUBLISHED\',\'CLOSED\')')
    assert.deepEqual(await snapshot(), before)
    return { mode: 'ACTIVATED', hash, periodsAwaitingRefresh: pending, recordsPreserved: Object.fromEntries(Object.entries(before).map(([name, value]) => [name, value.n])) }
  }, { isolationLevel: 'Serializable', timeout: 30000 })
  console.log(JSON.stringify(result))
}
main().catch(error => { console.error('Activación interrumpida:', error.code || error.message); process.exitCode = 1 }).finally(() => db.$disconnect())
