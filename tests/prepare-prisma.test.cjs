const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { prepare, clientState, isCurrent } = require('../scripts/prepare-prisma.cjs')

test('genera solo cuando cambia el esquema, las versiones o los archivos; un fallo no marca el cliente como válido', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-startup-'))
  t.after(() => {
    const resolved = fs.realpathSync(root)
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(resolved).startsWith('prisma-startup-'))
    fs.rmSync(resolved, { recursive: true, force: true })
  })
  const write = (name, value) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value) }
  write('prisma/schema.prisma', 'model User {\n  id String @id\n}\n')
  for (const name of ['prisma', '@prisma/client']) write('node_modules/' + name + '/package.json', JSON.stringify({ version: '5.22.0' }))
  const directory = path.join(root, 'node_modules/.prisma/client')
  let calls = 0
  const generate = () => {
    calls++
    for (const name of ['schema.prisma', 'index.js', 'index.d.ts', 'default.js', 'query_engine-windows.dll.node']) write('node_modules/.prisma/client/' + name, 'generated ' + calls)
    return { status: 0 }
  }
  prepare(root, generate)
  assert.equal(calls, 1)
  prepare(root, () => { throw Error('No debe tocar el motor mientras esté actualizado') })
  assert.ok(isCurrent(directory, clientState(root)))
  write('prisma/schema.prisma', 'model User {\n  id String @id\n  isBlacklisted Boolean\n}\n')
  assert.throws(() => prepare(root, () => ({ status: 1 })), /EPERM/)
  assert.equal(isCurrent(directory, clientState(root)), false, 'No oculta un cliente desactualizado tras una generación fallida')
  prepare(root, generate)
  assert.equal(calls, 2)
  write('node_modules/@prisma/client/package.json', JSON.stringify({ version: '5.23.0' }))
  prepare(root, generate)
  assert.equal(calls, 3)
  write('node_modules/.prisma/client/index.js', 'cliente reemplazado por otra generación')
  prepare(root, generate)
  assert.equal(calls, 4)
  fs.unlinkSync(path.join(directory, 'query_engine-windows.dll.node'))
  prepare(root, generate)
  assert.equal(calls, 5)
  write('prisma/schema.prisma', fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8').replace(/\n/g, '\r\n'))
  prepare(root, generate)
  assert.equal(calls, 5, 'Cambiar LF por CRLF no requiere reemplazar la DLL')
})
