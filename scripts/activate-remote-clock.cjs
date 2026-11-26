// Migración aditiva acotada. Sin --apply solo comprueba el estado.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { PrismaClient } = require('@prisma/client')
require('@next/env').loadEnvConfig(path.resolve(__dirname, '..'))
const db = new PrismaClient(), schema = new URL(process.env.DATABASE_URL).searchParams.get('schema') || 'public'
assert.match(schema, /^[a-zA-Z_][a-zA-Z0-9_]*$/)
async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations/202611260001_remote_clock/migration.sql'), 'utf8')
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean)
  for (const statement of statements) assert.match(statement, /^(ALTER TABLE "User" ADD COLUMN "isRemote"|CREATE TABLE "RemotePunch"|CREATE (UNIQUE )?INDEX "RemotePunch_)/)
  const result = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`)
    const columns = await tx.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema=${schema} AND table_name='User' AND column_name='isRemote'`
    const tables = await tx.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema=${schema} AND table_name='RemotePunch'`
    if (columns.length && tables.length) return { status: 'ALREADY_ACTIVE' }
    assert.equal(columns.length + tables.length, 0, 'Estado parcial; no se modifica la base automáticamente')
    if (process.argv[2] !== '--apply') return { status: 'READY', changes: 'Agregar permiso remoto (desactivado) y tabla de checadas con foto' }
    const before = await tx.user.count()
    for (const statement of statements) await tx.$executeRawUnsafe(statement)
    assert.equal(await tx.user.count(), before)
    const enabled = await tx.$queryRawUnsafe('SELECT count(*)::int AS n FROM "User" WHERE "isRemote"=true')
    assert.equal(enabled[0].n, 0)
    return { status: 'ACTIVATED', usersPreserved: before, remoteEnabled: 0 }
  }, { timeout: 30000 })
  console.log(JSON.stringify(result))
}
main().catch(e => { console.error(e.code || e.message); process.exitCode = 1 }).finally(() => db.$disconnect())
