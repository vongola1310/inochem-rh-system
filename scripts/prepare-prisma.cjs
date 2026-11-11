const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')

const hash = value => crypto.createHash('sha256').update(value).digest('hex')
const normalizeSchema = value => value.replace(/\r\n/g, '\n')

function clientState(root) {
  const version = name => JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version
  return {
    schema: hash(normalizeSchema(fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8'))),
    prisma: version('prisma'), client: version('@prisma/client'), platform: process.platform, arch: process.arch,
  }
}

function generatedFiles(directory) {
  const engines = fs.readdirSync(directory).filter(name => /^(?:libquery_engine-.*\.node|query_engine-.*\.node|query-engine-[^.]+(?:\.exe)?)$/.test(name))
  if (!engines.length) throw new Error('Falta el motor generado de Prisma.')
  return Object.fromEntries(['schema.prisma', 'index.js', 'index.d.ts', 'default.js', ...engines].sort().map(name => {
    const bytes = fs.readFileSync(path.join(directory, name))
    if (!bytes.length) throw new Error('Archivo generado vacío: ' + name)
    return [name, hash(bytes)]
  }))
}

function isCurrent(directory, state) {
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(directory, '.project-client-state.json'), 'utf8'))
    return JSON.stringify(saved.state) === JSON.stringify(state) && JSON.stringify(saved.files) === JSON.stringify(generatedFiles(directory))
  } catch { return false }
}

function prepare(root, generate = () => spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'generate'], { cwd: root, stdio: 'inherit', windowsHide: true })) {
  const directory = path.join(root, 'node_modules/.prisma/client'), state = clientState(root)
  if (isCurrent(directory, state)) {
    console.log('Cliente Prisma actualizado; no es necesario regenerar el motor.')
    return
  }
  console.log('Preparando cliente Prisma para el esquema actual...')
  const result = generate()
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('No se pudo generar Prisma. Si aparece EPERM en Windows, detén con Ctrl+C las otras terminales de este proyecto y vuelve a ejecutar npm run dev.')
  if (JSON.stringify(clientState(root)) !== JSON.stringify(state)) throw new Error('El esquema cambió durante la generación. Ejecuta npm run dev de nuevo.')
  // La marca se escribe solo después de una generación correcta y con archivos completos.
  fs.writeFileSync(path.join(directory, '.project-client-state.json'), JSON.stringify({ state, files: generatedFiles(directory) }))
}

if (require.main === module) {
  try { prepare(path.resolve(__dirname, '..')) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
module.exports = { prepare, clientState, isCurrent }
