const { test } = require('node:test')
const assert = require('node:assert/strict')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { groupAttendanceByLeader, attendanceCounts } = require('../lib/attendance/grouping.ts')
const day = (id, userId, managerId, extra = {}) => ({ id, userId, managerId, date: '2026-09-22', user: { name: 'Colaborador ' + userId, employeeNumber: userId }, manager: managerId ? { name: 'Óscar Pérez' } : null, entrySeconds: 29460, exitSeconds: 61200, exitEstimated: true, detectedIssues: ['LATE'], coverage: [], reviewStatus: 'WAITING_EMPLOYEE', decision: 'PENDING', justification: null, managerComment: null, ...extra })

test('agrupa por identidad del líder y del colaborador, sin mezclar jefes con el mismo nombre ni duplicar días', () => {
  const rows = [day('a', '100', 'boss1'), day('b', '100', 'boss1', { date: '2026-09-23' }), day('c', '200', 'boss1'), day('d', '300', 'boss2')]
  const groups = groupAttendanceByLeader(rows)
  assert.equal(groups.length, 2)
  const first = groups.find(group => group.id === 'leader:boss1')
  assert.equal(first.people.length, 2)
  assert.equal(first.days.length, 3)
  assert.deepEqual(first.people[0].days.map(row => row.id), ['b', 'a'])
  assert.equal(groups.flatMap(group => group.days).length, rows.length)
  assert.equal(rows[0].id, 'a', 'No reordena ni modifica la fuente')
})

test('N/A y sin responsable son grupos separados y N/A no suma incidencias ni pendientes', () => {
  const rows = [day('a', '100', null), day('b', '200', null, { reviewNotApplicable: true, reviewStatus: 'RESOLVED', decision: 'NONE' })]
  assert.deepEqual(groupAttendanceByLeader(rows).map(group => group.kind), ['unassigned', 'notApplicable'])
  assert.deepEqual(attendanceCounts(rows), { days: 2, issues: 1, employee: 1, manager: 0, resolved: 0, notApplicable: 1 })
  assert.equal(groupAttendanceByLeader(rows, { onlyIssues: true }).length, 1)
  assert.equal(groupAttendanceByLeader(rows, { state: 'RESOLVED' }).length, 0)
  assert.equal(groupAttendanceByLeader(rows, { state: 'NA' })[0].people[0].userId, '200')
})

test('buscar jefe muestra su equipo; buscar colaborador, fecha o estado filtra los días correctos', () => {
  const rows = [day('a', '100', 'boss'), day('b', '200', 'boss', { reviewStatus: 'WAITING_MANAGER', justification: 'Explicación' }), day('c', '300', 'other', { manager: { name: 'Ana' } })]
  assert.equal(groupAttendanceByLeader(rows, { search: 'oscar perez' })[0].people.length, 2)
  assert.equal(groupAttendanceByLeader(rows, { search: '200' })[0].people.length, 1)
  assert.equal(groupAttendanceByLeader(rows, { search: '22/09/2026' }).length, 2)
  assert.equal(groupAttendanceByLeader(rows, { search: 'oscar', state: 'WAITING_MANAGER' })[0].people.length, 2, 'Incluye pendientes heredados del flujo anterior')
  assert.deepEqual(groupAttendanceByLeader(rows, { search: 'inexistente' }), [])
})

test('un cambio de responsable conserva cada día con el jefe que dictaminó ese registro', () => {
  const rows = [day('a', '100', 'before'), day('b', '100', 'after', { date: '2026-09-23' })]
  const groups = groupAttendanceByLeader(rows)
  assert.equal(groups.length, 2)
  assert.ok(groups.every(group => group.people.length === 1 && group.days.length === 1))
})

test('los cinco filtros respetan coberturas, dictamen final, combinaciones y exclusión N/A', () => {
  const rows = [
    day('permit', 'a', 'boss', { detectedIssues: [], coverage: ['Home Office'], reviewStatus: 'RESOLVED', decision: 'JUSTIFIED' }),
    day('vacation', 'a', 'boss', { detectedIssues: [], coverage: ['Vacaciones'], reviewStatus: 'RESOLVED', decision: 'JUSTIFIED' }),
    day('absence', 'b', 'boss', { detectedIssues: ['ABSENCE'] }),
    day('exit', 'c', 'boss', { detectedIssues: ['EARLY_EXIT'] }),
    day('late', 'd', 'boss'),
    day('combined', 'e', 'boss', { reviewStatus: 'RESOLVED', decision: 'LATE_EARLY_EXIT' }),
    day('justified', 'f', 'boss', { detectedIssues: ['ABSENCE'], reviewStatus: 'RESOLVED', decision: 'JUSTIFIED' }),
    day('na', 'g', null, { detectedIssues: ['ABSENCE'], reviewStatus: 'RESOLVED', decision: 'NONE', reviewNotApplicable: true }),
  ]
  for (const [category, ids] of Object.entries({ permits: ['permit'], vacations: ['vacation'], absences: ['absence'], exits: ['combined', 'exit'], late: ['combined', 'late'] })) {
    assert.deepEqual(groupAttendanceByLeader(rows, { category }).flatMap(group => group.days).map(row => row.id).sort(), ids, category)
  }
})
