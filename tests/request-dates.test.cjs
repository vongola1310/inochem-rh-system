const { test } = require('node:test')
const assert = require('node:assert/strict')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { calendarKey, calendarDate, vacationBreakdown, birthdayPermission, validateRequestDates } = require('../lib/request-dates.ts')
const holidays = new Set(['2026-11-16', '2026-12-25'])
const now = new Date('2026-11-19T18:00:00Z')

test('las fechas civiles y festivos se conservan en México, UTC y otras zonas', () => {
  const original = process.env.TZ
  try {
    for (const zone of ['America/Mexico_City', 'UTC', 'Pacific/Auckland', 'America/Los_Angeles']) {
      process.env.TZ = zone
      assert.equal(calendarKey(calendarDate('2026-11-16')), '2026-11-16', zone)
      assert.deepEqual(vacationBreakdown('2026-11-13', '2026-11-18', holidays, new Date('1990-11-17T00:00:00Z')), { total: 5, weekends: 2, holidays: 1, birthday: 1, business: 1 }, zone)
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original }
})

test('regreso excluido, cruce de año y vacaciones solo de cumpleaños', () => {
  assert.equal(vacationBreakdown('2026-12-24', '2027-01-04', new Set(['2026-12-25', '2027-01-01'])).business, 5)
  assert.deepEqual(vacationBreakdown('2026-11-19', '2026-11-20', holidays, '1990-11-19'), { total: 1, weekends: 0, holidays: 0, birthday: 1, business: 0 })
})

test('rechaza rangos invertidos, igualdad, fechas inexistentes y extremos inhábiles', () => {
  for (const [start, end] of [['2026-11-20','2026-11-19'], ['2026-11-19','2026-11-19'], ['2026-02-30','2026-03-02'], ['2026-11-16','2026-11-19'], ['2026-11-19','2026-11-21']]) {
    assert.ok(validateRequestDates('VACATION', start, end, holidays))
  }
  assert.equal(validateRequestDates('VACATION','2026-11-13','2026-11-18',holidays),null)
})

test('cumpleaños exacto, ausente, festivo, fin de semana y 29 de febrero', () => {
  assert.equal(birthdayPermission('1990-11-19', holidays, now).key, '2026-11-19')
  for (const birth of [null, '1990-11-16', '1990-11-21', '1992-02-29']) assert.ok(birthdayPermission(birth, holidays, now).error)
  assert.equal(birthdayPermission('1992-02-29', holidays, new Date('2028-01-01T18:00:00Z')).key,'2028-02-29')
  assert.equal(birthdayPermission('1990-11-19', holidays, new Date('2027-01-01T03:00:00Z')).key,'2026-11-19')
  assert.ok(validateRequestDates('PERMIT_BIRTHDAY','2026-11-20','2026-11-20',holidays,'1990-11-19',now))
  assert.equal(validateRequestDates('PERMIT_BIRTHDAY','2026-11-19','2026-11-19',holidays,'1990-11-19',now),null)
})

test('el servidor valida antes de crear y guarda las mismas fechas que el calendario', async () => {
  const Module = require('node:module'), path = require('node:path'), originalLoad = Module._load
  let written = [], transactions = 0
  const user = { id: 'qa', name: 'QA', bossId: 'boss', boss: {}, entryDate: new Date('2020-06-01T00:00:00Z'), birthDate: new Date('1990-11-17T00:00:00Z'), balance: { totalDays: 40, usedDays: 0, pendingDays: 0 } }
  const tx = { request: { create: async ({data}) => { written.push(data); return { id:'qa-request' } } }, vacationBalance: { update: async () => ({}) }, notification: { create: async () => ({}) } }
  const mocks = {
    '@/auth': { auth: async () => ({user:{id:'qa'}}) },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/prisma': { prisma: { user: { findUnique: async () => user }, holiday: { findMany: async () => [...holidays].map(key => ({date:new Date(key+'T00:00:00Z')})) } } },
    '@/lib/check-renewal': { checkAndRenewBalance: async () => false },
    '@/lib/vacation-balance': { renewBalanceInTransaction: async () => false, withBalanceTransaction: async work => { transactions++; return work(tx) } },
    '@/lib/attendance/staleness': { markAttendanceStale: async () => {} },
  }
  Module._load = function(id, parent, main) {
    if (mocks[id]) return mocks[id]
    if (id.startsWith('@/')) return originalLoad.call(this, path.resolve(__dirname,'..',id.slice(2)),parent,main)
    return originalLoad.call(this,id,parent,main)
  }
  try {
    const { createRequest } = require('../app/actions/create-request.ts')
    async function submit(type,start,end) {
      const form = new FormData()
      for (const [key,value] of Object.entries({userId:'qa',type,startDate:start,returnDate:end,observations:'QA',daysRequested:'999'})) form.set(key,value)
      return createRequest(null,form)
    }
    assert.equal((await submit('VACATION','2026-11-20','2026-11-19')).success,false)
    assert.equal((await submit('VACATION','2026-11-16','2026-11-19')).success,false)
    assert.equal((await submit('VACATION','2026-02-30','2026-03-02')).success,false)
    assert.equal(transactions,0)
    assert.equal((await submit('VACATION','2026-11-13','2026-11-18')).success,true)
    assert.equal(written[0].startDate.toISOString(),'2026-11-13T00:00:00.000Z')
    assert.equal(written[0].returnDate.toISOString(),'2026-11-18T00:00:00.000Z')
    assert.equal(written[0].daysRequested,1,'Recalcula y no confía en los 999 enviados')
    assert.equal((await submit('PERMIT_HOME_OFFICE','2026-11-19','2026-11-19')).success,true)
    assert.equal(written[1].startDate.toISOString(),'2026-11-19T00:00:00.000Z')
    user.birthDate = null
    assert.equal((await submit('PERMIT_BIRTHDAY','2026-11-19','2026-11-19')).success,false)
    assert.equal(written.length,2)
  } finally { Module._load = originalLoad }
})
