const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const Module = require('node:module')
const bcrypt = require('bcryptjs')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })

// Se ejecutan las acciones reales y bcrypt, con autenticación y almacenamiento aislados.
// Ninguna prueba conecta con la base de datos ni cambia contraseñas de usuarios reales.
let session, actorRole, reads, writes, paths, users, failUpdate
const fakeDb = {
  user: {
    findUnique: async args => {
      reads.push(args)
      assert.deepEqual(args, { where: { id: 'actor' }, select: { role: true } })
      return actorRole ? { role: actorRole } : null
    },
    updateMany: async args => {
      if (failUpdate) throw new Error('Database detail must remain private')
      const target = users.get(args.where.id)
      writes.push(args)
      if (!target) return { count: 0 }
      Object.assign(target, args.data)
      return { count: 1 }
    },
  },
  $transaction: async () => { throw new Error('Unauthorized administrative write') },
}
const realLoad = Module._load
Module._load = function (id, parent, isMain) {
  if (id === '@/auth') return { auth: async () => session }
  if (id === '@/lib/prisma' || (id === './prisma' && parent?.filename.endsWith('employee-access.ts'))) return { prisma: fakeDb }
  if (id === 'next/cache') return { revalidatePath: value => paths.push(value) }
  if (id === 'next/navigation') return { redirect: () => { throw new Error('Unexpected redirect') } }
  if (id === '@prisma/client') return { PrismaClient: function () { return fakeDb } }
  if (id.startsWith('@/')) id = path.resolve(__dirname, '..', id.slice(2))
  return realLoad.call(this, id, parent, isMain)
}
const { resetEmployeePassword } = require('../app/actions/reset-employee-password.ts')
const { updateEmployee, deleteEmployee } = require('../app/actions/employee-management.ts')
const { registerEmployee } = require('../app/actions/register-employee.ts')
Module._load = realLoad

beforeEach(() => {
  session = { user: { id: 'actor', role: 'HR' } }
  actorRole = 'HR'
  reads = []
  writes = []
  paths = []
  failUpdate = false
  users = new Map([
    ['employee-a', { password: 'old-test-password', passwordChanged: true, name: 'Empleado A', role: 'EMPLOYEE' }],
    ['employee-b', { password: 'other-test-password', passwordChanged: true, name: 'Empleado B', role: 'EMPLOYEE' }],
  ])
})

function form(overrides = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries({ employeeId: 'employee-a', newPassword: 'Temporal-prueba-123', confirmPassword: 'Temporal-prueba-123', ...overrides })) {
    if (value !== null) data.set(key, value)
  }
  return data
}

test('rechaza la operación sin una sesión identificada', async () => {
  for (const value of [null, { user: {} }]) {
    session = value
    assert.equal((await resetEmployeePassword(form())).success, false)
  }
  assert.equal(reads.length, 0)
  assert.equal(writes.length, 0)
})

test('solo el rol vigente RH puede restablecer; no basta un rol HR antiguo en el token', async () => {
  for (const role of ['EMPLOYEE', 'ADMIN', null]) {
    actorRole = role
    assert.equal((await resetEmployeePassword(form())).success, false)
  }
  assert.equal(reads.length, 3)
  assert.equal(writes.length, 0)
})

test('RH cambia solo la contraseña del empleado elegido y habilita su cambio personal', async () => {
  const otherBefore = structuredClone(users.get('employee-b'))
  const data = form({ role: 'HR', passwordChanged: 'true', email: 'ignored@example.test' })
  const result = await resetEmployeePassword(data)
  assert.equal(result.success, true)
  assert.equal(writes.length, 1)
  assert.deepEqual(writes[0].where, { id: 'employee-a' })
  assert.deepEqual(Object.keys(writes[0].data).sort(), ['password', 'passwordChanged'])
  const target = users.get('employee-a')
  assert.notEqual(target.password, data.get('newPassword'))
  assert.equal(await bcrypt.compare(data.get('newPassword'), target.password), true)
  assert.equal(await bcrypt.compare('old-test-password', target.password), false)
  assert.equal(target.passwordChanged, false)
  assert.equal(target.role, 'EMPLOYEE')
  assert.deepEqual(users.get('employee-b'), otherBefore)
  assert.deepEqual(paths, ['/admin/employees/employee-a', '/profile'])
  assert.equal(JSON.stringify(result).includes(data.get('newPassword')), false)
  assert.equal(JSON.stringify(result).includes(target.password), false)
})

test('valida identidad, longitud, confirmación y entradas que no son texto antes de escribir', async () => {
  for (const invalid of [
    { employeeId: null }, { employeeId: '   ' }, { employeeId: new Blob(['id']) },
    { newPassword: null }, { newPassword: 'corta' }, { newPassword: '        ' },
    { newPassword: new Blob(['not a password']) },
    { confirmPassword: null }, { confirmPassword: 'otra-contraseña' },
    { newPassword: 'a'.repeat(73), confirmPassword: 'a'.repeat(73) },
    { newPassword: 'é'.repeat(37), confirmPassword: 'é'.repeat(37) },
  ]) {
    assert.equal((await resetEmployeePassword(form(invalid))).success, false)
  }
  assert.equal(writes.length, 0)
  assert.equal(paths.length, 0)
})

test('admite contraseñas multibyte dentro del límite sin recortarlas', async () => {
  const password = 'é'.repeat(36)
  assert.equal((await resetEmployeePassword(form({ newPassword: password, confirmPassword: password }))).success, true)
  assert.equal(await bcrypt.compare(password, users.get('employee-a').password), true)
})

test('informa si el empleado dejó de existir sin modificar otra cuenta', async () => {
  const before = structuredClone(users)
  assert.equal((await resetEmployeePassword(form({ employeeId: 'missing' }))).success, false)
  assert.deepEqual(users, before)
  assert.equal(paths.length, 0)
})

test('un fallo del almacenamiento devuelve un error sin datos internos ni contraseñas', async () => {
  failUpdate = true
  const result = await resetEmployeePassword(form())
  assert.equal(result.success, false)
  assert.equal(result.message.includes('Database detail'), false)
  assert.equal(result.message.includes('Temporal-prueba-123'), false)
  assert.equal(users.get('employee-a').password, 'old-test-password')
})

test('las acciones de usuarios no permiten otorgarse RH para acceder al restablecimiento', async () => {
  for (const role of ['EMPLOYEE', 'ADMIN', null]) {
    actorRole = role
    const data = form({ id: 'actor', role: 'HR' })
    assert.equal((await updateEmployee(data)).success, false)
    assert.equal((await registerEmployee(data)).success, false)
    assert.equal((await deleteEmployee('employee-a')).success, false)
  }
  assert.equal(writes.length, 0)
})
