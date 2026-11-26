const { test } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')
const path = require('node:path')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node', jsx: 'react-jsx' } })

test('el responsable autorizado conserva acceso desde asistencia y dictámenes sin ser RH ni Admin', async () => {
  let account
  const db = {
    user: {
      findUnique: async ({ select }) => Object.fromEntries(Object.keys(select).map(key => [key, account[key]])),
      count: async () => 0, findMany: async () => [],
    },
    attendanceImport: { findMany: async () => [] },
    attendanceDay: { count: async () => 0, findMany: async () => [] },
  }
  const originalLoad = Module._load
  Module._load = function(id, parent, main) {
    if (id === '@/auth') return { auth: async () => ({ user: { id: 'qa-user' } }) }
    if (id === '@/lib/prisma') return { prisma: db }
    if (id === 'next/navigation') return { redirect: target => { throw new Error('REDIRECT ' + target) } }
    if (id === '@/app/actions/attendance-review') return { reviewAttendanceDay: async () => { throw new Error('No writes in navigation test') } }
    if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) }
    if (id.startsWith('@/')) return originalLoad.call(this, path.resolve(__dirname, '..', id.slice(2)), parent, main)
    return originalLoad.call(this, id, parent, main)
  }
  try {
    const Page = require('../app/attendance/page.tsx').default
    const { fieldReportActor } = require('../lib/field-reports/access.ts')
    for (const [role, enabled, allowed] of [['EMPLOYEE', true, true], ['EMPLOYEE', false, false], ['HR', false, true], ['ADMIN', false, true]]) {
      account = { id: 'qa-user', name: 'QA', role, canUploadFieldReports: enabled, isBlacklisted: false }
      for (const view of [undefined, 'team']) {
        const html = renderToStaticMarkup(await Page({ searchParams: { view } }))
        assert.equal(html.includes('href="/field-reports"'), allowed, `${role}, permiso=${enabled}, vista=${view || 'personal'}`)
        assert.equal(html.includes('href="/admin/attendance"'), role === 'HR' || role === 'ADMIN', 'La autorización de campo no concede administración')
      }
      if (allowed) assert.equal((await fieldReportActor()).canUploadFieldReports, true)
      else await assert.rejects(fieldReportActor(), /responsable autorizado/)
    }
    account = { id: 'qa-user', name: 'Líder', role: 'EMPLOYEE', canUploadFieldReports: false, isBlacklisted: false }
    const personal = renderToStaticMarkup(await Page({ searchParams: {} }))
    assert.ok(personal.includes('Mis checadas remotas'), 'Mi asistencia conserva los registros personales')
    assert.ok(!personal.includes('Asistencia remota de mi equipo'), 'La asistencia del equipo no se mezcla con la personal')
    const team = renderToStaticMarkup(await Page({ searchParams: { view: 'team' } }))
    assert.equal(team.split('Asistencia remota de mi equipo').length - 1, 1, 'El equipo aparece en Dictámenes a mi cargo')
    assert.ok(!team.includes('Mis checadas remotas'), 'La revisión del equipo no incluye checadas personales')
    account = { ...account, canUploadFieldReports: true, isBlacklisted: true }
    await assert.rejects(fieldReportActor(), /No tienes permiso/)
    await assert.rejects(Page({ searchParams: { view: 'team' } }), /REDIRECT \/login/)
  } finally { Module._load = originalLoad }
})
