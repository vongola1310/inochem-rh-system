// Adición acotada; sin --apply <hash> solo inspecciona la base.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { PrismaClient } = require('@prisma/client')
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'))
const db = new PrismaClient()
const schema = new URL(process.env.DATABASE_URL).searchParams.get('schema') || 'public'
assert.match(schema, /^[a-zA-Z_][a-zA-Z0-9_]*$/)
const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/202610270001_employee_blacklist/migration.sql'), 'utf8')
assert.equal(sql.trim(), 'ALTER TABLE "User" ADD COLUMN "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,\nADD COLUMN "blacklistedAt" TIMESTAMP(3);')
const hash = crypto.createHash('sha256').update(sql).digest('hex')
async function main() {
  const apply = process.argv[2] === '--apply'
  if (apply) assert.equal(process.argv[3], hash)
  const result = await db.$transaction(async tx => {
    if (!apply) await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`)
    const columns = await tx.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema=${schema} AND table_name='User' AND column_name IN ('isBlacklisted', 'blacklistedAt')`
    const snapshot = () => tx.$queryRawUnsafe(`SELECT to_jsonb(u) - 'isBlacklisted' - 'blacklistedAt' AS record FROM "${schema}"."User" u ORDER BY id`)
    const before = await snapshot()
    if (!apply) return { mode: 'READ_ONLY', hash, existingColumns: columns.map(c => c.column_name), users: before.length }
    assert.equal(columns.length, 0, 'Los campos ya existen; no se aplicará de nuevo ni parcialmente.')
    await tx.$executeRawUnsafe(sql)
    assert.deepEqual(await snapshot(), before, 'Deben conservarse todos los datos existentes.')
    assert.equal((await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${schema}"."User" WHERE "isBlacklisted" OR "blacklistedAt" IS NOT NULL`))[0].n, 0)
    return { mode: 'ACTIVATED', hash, usersPreserved: before.length, blacklistedUsers: 0 }
  }, { isolationLevel: 'Serializable', timeout: 30000 })
  console.log(JSON.stringify(result))
}
main().catch(e => { console.error('Activación interrumpida:', e.code || e.message); process.exitCode = 1 }).finally(() => db.$disconnect())
