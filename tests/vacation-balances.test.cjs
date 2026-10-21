const { test } = require('node:test')
const assert = require('node:assert/strict')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { getCycleBounds } = require('../lib/vacation-cycle.ts')
const { calculateVacationUsage } = require('../lib/vacation-usage.ts')
const { renewBalanceInTransaction, withBalanceTransaction } = require('../lib/vacation-balance.ts')
const { Prisma } = require('@prisma/client')
const { transitionRequest } = require('../lib/request-transition.ts')
const { prisma } = require('../lib/prisma.ts')
const entryDate = new Date('2023-06-19T12:00:00Z')
const asOf = new Date('2026-10-21T18:00:00Z')
const bounds = getCycleBounds(entryDate, asOf)
const vacation = (status, daysRequested, startDate = '2026-08-05T00:00:00Z') => ({ status, daysRequested, startDate: new Date(startDate) })
const usage = requests => calculateVacationUsage(requests, bounds.cycleStart, bounds.cycleEnd)

test('33126: 18 con RH + 3 firmados por jefe = 21 comprometidos, cero pendientes del jefe', () => {
  const requests = [11, 1, 1, 2, 2, 1].map(days => vacation('APPROVED', days))
  requests.push(vacation('PENDING_HR', 3, '2026-11-12T00:00:00Z'))
  requests.push(...[10, 1, 4, 1, 2].map(days => vacation('CANCELLED', days)))
  assert.deepEqual(usage(requests), { usedDays: 21, pendingDays: 0, pendingHRDays: 3 })
})
test('RH es un subconjunto de aprobados; solo PENDING_BOSS ocupa pendientes', () => {
  assert.deepEqual(usage([vacation('PENDING_BOSS', 2), vacation('PENDING_HR', 3), vacation('APPROVED', 4)]), {
    usedDays: 7, pendingDays: 2, pendingHRDays: 3,
  })
})
test('cancelación solicitada conserva la reserva, cancelada y rechazada la liberan', () => {
  assert.deepEqual(usage([vacation('CANCELLATION_REQUESTED', 3), vacation('CANCELLED', 5), vacation('REJECTED', 2)]), {
    usedDays: 3, pendingDays: 0, pendingHRDays: 0,
  })
})
test('cada solicitud pertenece a un ciclo por su inicio, incluyendo anticipadas', () => {
  assert.equal(usage([vacation('APPROVED', 11, '2026-06-19T00:00:00Z')]).usedDays, 11)
  assert.equal(usage([vacation('APPROVED', 9, '2026-06-18T00:00:00Z'), vacation('PENDING_HR', 5, '2027-06-19T00:00:00Z')]).usedDays, 0)
})
test('la renovación espera a medianoche de México, no a medianoche UTC', () => {
  assert.equal(getCycleBounds(entryDate, new Date('2026-06-19T03:00:00Z')).cycleStart.toISOString(), '2025-06-19T00:00:00.000Z')
  assert.equal(getCycleBounds(entryDate, new Date('2026-06-19T06:00:00Z')).cycleStart.toISOString(), '2026-06-19T00:00:00.000Z')
})

function fakeTransaction(requests, initialBalance) {
  let balance = { ...initialBalance }
  let writes = 0
  const tx = {
    request: {
      findUnique: async ({ where }) => {
        const row = requests.find(r => r.id === where.id)
        return row ? structuredClone(row) : null
      },
      findMany: async ({ where }) => requests.filter(r => r.userId === where.userId && r.type === 'VACATION' && r.startDate >= where.startDate.gte && r.startDate < where.startDate.lt),
      updateMany: async ({ where, data }) => {
        const row = requests.find(r => r.id === where.id && r.status === where.status)
        if (!row) return { count: 0 }
        Object.assign(row, data)
        return { count: 1 }
      },
    },
    vacationBalance: {
      findUnique: async () => ({ ...balance }),
      update: async ({ data }) => {
        writes++
        for (const [key, value] of Object.entries(data)) balance[key] = value && typeof value === 'object' && 'increment' in value ? balance[key] + value.increment : value
        return { ...balance }
      },
    },
  }
  return { tx, balance: () => balance, writes: () => writes }
}
test('aniversario incorpora vacaciones anticipadas aprobadas y pendientes', async () => {
  const rows = [vacation('PENDING_HR', 11, '2026-06-19T00:00:00Z'), vacation('PENDING_BOSS', 2), vacation('APPROVED', 7, '2025-07-01T00:00:00Z')]
    .map(r => ({ ...r, userId: 'u', type: 'VACATION' }))
  const store = fakeTransaction(rows, { totalDays: 19, usedDays: 7, pendingDays: -11, lastYearProcessed: 2 })
  assert.equal(await renewBalanceInTransaction(store.tx, 'u', entryDate, asOf), true)
  assert.equal(store.balance().totalDays, 21)
  assert.equal(store.balance().usedDays, 11)
  assert.equal(store.balance().pendingDays, 2)
  assert.equal(await renewBalanceInTransaction(store.tx, 'u', entryDate, asOf), false)
  assert.equal(store.writes(), 1)
})
test('no sobrescribe ajustes manuales de un periodo ya inicializado', async () => {
  const store = fakeTransaction([], { totalDays: 30, usedDays: 5, pendingDays: 0, lastYearProcessed: 3 })
  assert.equal(await renewBalanceInTransaction(store.tx, 'u', entryDate, asOf), false)
  assert.equal(store.writes(), 0)
})
test('firma y visto bueno repetidos no descuentan dos veces; cancelación devuelve solo una vez', async () => {
  const current = getCycleBounds(entryDate)
  const years = current.cycleStart.getUTCFullYear() - entryDate.getUTCFullYear()
  const row = { id: 'r', userId: 'u', type: 'VACATION', ...vacation('PENDING_BOSS', 3, current.cycleStart.toISOString()), user: { entryDate } }
  const store = fakeTransaction([row], { totalDays: 21, usedDays: 5, pendingDays: 3, lastYearProcessed: years })
  const original = prisma.$transaction
  prisma.$transaction = async work => work(store.tx)
  try {
    assert.equal(await transitionRequest('r', ['PENDING_BOSS'], 'PENDING_HR'), true)
    assert.equal(await transitionRequest('r', ['PENDING_BOSS'], 'PENDING_HR'), false)
    assert.equal(store.balance().usedDays, 8)
    assert.equal(store.balance().pendingDays, 0)
    assert.equal(await transitionRequest('r', ['PENDING_HR'], 'APPROVED'), true)
    assert.equal(await transitionRequest('r', ['PENDING_HR'], 'APPROVED'), false)
    assert.equal(store.balance().usedDays, 8)
    await transitionRequest('r', ['APPROVED'], 'CANCELLATION_REQUESTED')
    assert.equal(store.balance().usedDays, 8)
    await transitionRequest('r', ['CANCELLATION_REQUESTED'], 'CANCELLED')
    await transitionRequest('r', ['CANCELLATION_REQUESTED'], 'CANCELLED')
    assert.equal(store.balance().usedDays, 5)
    assert.equal(store.balance().pendingDays, 0)
  } finally { prisma.$transaction = original }
})
test('una solicitud del próximo ciclo no cambia el saldo vigente al aprobarse', async () => {
  const current = getCycleBounds(entryDate)
  const row = { id: 'future', userId: 'u', type: 'VACATION', ...vacation('PENDING_BOSS', 11, current.cycleEnd.toISOString()), user: { entryDate } }
  const store = fakeTransaction([row], { totalDays: 21, usedDays: 5, pendingDays: 0, lastYearProcessed: current.cycleStart.getUTCFullYear() - entryDate.getUTCFullYear() })
  const original = prisma.$transaction
  prisma.$transaction = async work => work(store.tx)
  try {
    await transitionRequest('future', ['PENDING_BOSS'], 'PENDING_HR')
    await transitionRequest('future', ['PENDING_HR'], 'APPROVED')
    assert.equal(store.balance().usedDays, 5)
    assert.equal(store.balance().pendingDays, 0)
  } finally { prisma.$transaction = original }
})

test('la corrección funciona para distintos empleados y cada operación conserva intacto el saldo del otro', async () => {
  const employees = [
    { id: 'employee-a', entryDate: new Date('2023-06-19T12:00:00Z'), approved: 5, pending: 2 },
    { id: 'employee-b', entryDate: new Date('2020-02-10T12:00:00Z'), approved: 7, pending: 4 },
  ]
  const rows = employees.flatMap(employee => {
    const start = getCycleBounds(employee.entryDate).cycleStart.toISOString()
    return [
      { id: employee.id + '-pending', ...vacation('PENDING_BOSS', employee.pending, start) },
      { id: employee.id + '-approved', ...vacation('APPROVED', employee.approved, start) },
    ].map(row => ({ ...row, userId: employee.id, type: 'VACATION', user: { entryDate: employee.entryDate } }))
  })
  const stores = new Map(employees.map(employee => [employee.id, fakeTransaction(rows, {
    totalDays: 30, usedDays: employee.approved, pendingDays: employee.pending,
    lastYearProcessed: getCycleBounds(employee.entryDate).cycleStart.getUTCFullYear() - employee.entryDate.getUTCFullYear(),
  })]))
  const tx = {
    request: stores.get(employees[0].id).tx.request,
    vacationBalance: {
      findUnique: args => stores.get(args.where.userId).tx.vacationBalance.findUnique(args),
      update: args => stores.get(args.where.userId).tx.vacationBalance.update(args),
    },
  }
  const original = prisma.$transaction
  prisma.$transaction = async work => work(tx)
  try {
    for (const employee of employees) {
      const store = stores.get(employee.id)
      const other = stores.get(employees.find(item => item.id !== employee.id).id)
      const otherBefore = structuredClone(other.balance())
      const requestId = employee.id + '-pending'
      assert.equal(await transitionRequest(requestId, ['PENDING_BOSS'], 'PENDING_HR'), true)
      assert.equal(store.balance().usedDays, employee.approved + employee.pending)
      assert.equal(store.balance().pendingDays, 0)
      assert.deepEqual(other.balance(), otherBefore)
      assert.equal(await transitionRequest(requestId, ['PENDING_HR'], 'APPROVED'), true)
      assert.equal(store.balance().usedDays, employee.approved + employee.pending)
      assert.deepEqual(other.balance(), otherBefore)
      await transitionRequest(requestId, ['APPROVED'], 'CANCELLATION_REQUESTED')
      await transitionRequest(requestId, ['CANCELLATION_REQUESTED'], 'CANCELLED')
      assert.equal(store.balance().usedDays, employee.approved)
      assert.equal(store.balance().pendingDays, 0)
      assert.deepEqual(other.balance(), otherBefore)
    }
  } finally { prisma.$transaction = original }
})

test('un conflicto concurrente reintenta la transacción serializable; otros errores se propagan', async () => {
  const original = prisma.$transaction
  let attempts = 0
  prisma.$transaction = async (work, options) => {
    assert.equal(options.isolationLevel, 'Serializable')
    attempts++
    if (attempts === 1) throw new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: '5.22.0' })
    return work({})
  }
  try {
    assert.equal(await withBalanceTransaction(async () => 'ok'), 'ok')
    assert.equal(attempts, 2)
    prisma.$transaction = async () => { throw new Error('unexpected') }
    await assert.rejects(() => withBalanceTransaction(async () => true), /unexpected/)
  } finally { prisma.$transaction = original }
})
