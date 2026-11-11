const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path'), Module = require('node:module'), XLSX = require('xlsx')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const original = Module._load
Module._load = function (id, parent, main) { return original.call(this, id.startsWith('@/') ? path.join(__dirname, '..', id.slice(2)) : id, parent, main) }
const { parseFieldReport } = require('../lib/field-reports/parser.ts')
const { buildFieldPreview, suggestFieldMappings } = require('../lib/field-reports/preview.ts')
const { buildPreview } = require('../lib/attendance/engine.ts')
const { initialReviewState } = require('../lib/attendance/review-policy.ts')
Module._load = original
const headers = ['Work Order Number','Appointment Number','Owner: Full Name','Actual End','Start Date','Status','Work Type: Work Type Name','Actual Duration (Net Hours)','Working Hours','Account: Account Name']
const row = (extra = {}) => ({ row: 2, appointment: 'SA-1', workOrder: '001', owner: 'María Pérez López', status: 'Completed', workType: 'Support', start: '2026-10-12T10:00:00', end: '2026-10-14T15:00:00', netHours: 2, workingHours: 2, account: 'Prueba', rawStart: '12/10/2026 10:00 AM', rawEnd: '14/10/2026 03:00 PM', issues: [], ...extra })
const employees = [{ id: 'person', name: 'PÉREZ LÓPEZ MARÍA', employeeNumber: '1', isBlacklisted: false, entryDate: '2020-01-01' }]
const source = records => ({ records, digest: 'test', fileName: 'test.xlsx', sheetName: 'SA_RH report' })
const mappings = { 'María Pérez López': { userId: 'person', reason: 'Confirmado' } }
const preview = (records, extra = {}) => buildFieldPreview({ source: source(records), mappings, employees, start: '2026-10-01', end: '2026-10-20', holidays: [], today: '2026-10-28', ...extra })
function book(rows) { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'SA_RH report'); return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) }

test('lee fechas día/mes, AM/PM e identificadores, sin convertir el inicio en una checada', () => {
  const file = parseFieldReport(book([['001','SA-1','María Pérez López','7/10/2026 05:50 PM','7/10/2026 03:13 PM','Completed','Support',2.6,2.62,'Prueba']]), 'test.xlsx')
  assert.equal(file.records[0].start, '2026-10-07T15:13:00')
  assert.equal(file.records[0].end, '2026-10-07T17:50:00')
  assert.equal(file.records[0].workOrder, '001')
  assert.deepEqual(file.records[0].issues, [])
})
test('rechaza encabezados ajenos y detecta fechas imposibles y citas duplicadas', () => {
  assert.throws(() => parseFieldReport(Buffer.from('sin Excel'), 'test.csv'))
  const records = parseFieldReport(book([['1','SA-X','Persona','31/2/2026 5:00 PM','1/2/2026 8:00 AM','Completed'],['2','SA-X','Persona','','','Open']]), 'test.xlsx').records
  assert.ok(records[0].issues.includes('Fecha u hora inválida'))
  assert.ok(records.every(row => row.issues.some(issue => issue.includes('duplicada'))))
})
test('vincula nombres completos en distinto orden y sin acentos; homónimos requieren selección', () => {
  assert.equal(suggestFieldMappings(source([row()]), employees)['María Pérez López'].userId, 'person')
  assert.equal(suggestFieldMappings(source([row()]), [...employees, { ...employees[0], id: 'other' }])['María Pérez López'], undefined)
  assert.equal(suggestFieldMappings(source([row()]), [{ ...employees[0], isBlacklisted: true }])['María Pérez López'], undefined)
})
test('distribuye intervalos reales por jornada sin repetir la duración acumulada', () => {
  const result = preview([row()])
  assert.deepEqual(result.days.map(day => day.date), ['2026-10-12','2026-10-13','2026-10-14'])
  assert.deepEqual(result.days.map(day => [day.entrySeconds, day.exitSeconds]), [[36000, 61200], [28800, 61200], [28800, 54000]])
  assert.deepEqual(result.errors, [])
})
test('usa intervalos válidos, no el estado; excluye incompletos, futuros y fuera del periodo', () => {
  const result = preview([row({ status: 'Open' }), row({ row: 3, start: null, issues: ['Faltan fechas'] }), row({ row: 4, end: '2026-10-30T10:00:00' }), row({ row: 5, start: '2026-09-01T10:00:00', end: '2026-09-01T12:00:00' })])
  assert.equal(result.days.length, 3)
  assert.equal(result.omitted.length, 3)
})
test('respeta festivos, fines de semana, fecha de ingreso, lista negra y omisiones con motivo', () => {
  assert.deepEqual(preview([row()], { holidays: ['2026-10-13'] }).days.map(day => day.date), ['2026-10-12','2026-10-14'])
  assert.equal(preview([row()], { holidays: ['2026-10-13'] }).coverageDays.length, 3, 'Retiene intervalo por si RH corrige el calendario')
  assert.equal(preview([row()], { employees: [{ ...employees[0], isBlacklisted: true }] }).days.length, 0)
  assert.equal(preview([row()], { mappings: {} }).errors.length, 1)
  assert.equal(preview([row()], { mappings: { 'María Pérez López': { userId: null, reason: 'Fuera del equipo' } } }).errors.length, 0)
  assert.equal(preview([row()], { employees: [{ ...employees[0], entryDate: '2026-10-14' }] }).days.length, 1)
  assert.equal(preview([row({ start: '2026-10-10T08:00:00', end: '2026-10-11T17:00:00' })]).days.length, 0)
})

const field = { reportId: 'field', userId: 'person', date: '2026-10-12', appointments: ['SA-1'], rows: [2], entrySeconds: 36000, exitSeconds: 54000, services: [{ appointment: 'SA-1', account: 'Cliente A', startSeconds: 36000, endSeconds: 54000, workedSeconds: 18000, method: 'INTERVAL' }] }
function attendance(times, extra = {}) {
  return buildPreview({ start: '2026-10-12', end: '2026-10-12', sources: [{ site: 'AJUSCO', name: 'test.csv', warnings: [], people: [{ externalId: '1', name: 'Persona' }], punches: times.map(seconds => ({ externalId: '1', seconds, date: '2026-10-12', site: 'AJUSCO', row: 2, name: 'Persona' })) }], employees: [{ ...employees[0], bossId: 'boss' }, { ...employees[0], id: 'boss', employeeNumber: '2', bossId: null }], config: { includedUserIds: ['person'], excludedUsers: { boss: 'Fuera de prueba' }, reviewers: {}, mappings: {} }, requests: [], leaves: [], holidays: [], fieldWork: [field], ...extra }).days[0]
}

test('cinco horas de campo generan incidencia sin inventar checadas', () => {
  const day = attendance([])
  assert.deepEqual(day.detectedIssues, ['FIELD_INSUFFICIENT_HOURS'])
  assert.equal(day.entrySeconds, null); assert.equal(day.exitSeconds, null)
  assert.equal(day.evidence.workSummary.workedSeconds, 18000)
  assert.equal(initialReviewState(day).reviewStatus, 'WAITING_MANAGER')
})
const service = (id, start, end, hours = end - start) => ({ appointment: id, account: 'Cliente ' + id, startSeconds: start * 3600, endSeconds: end * 3600, workedSeconds: hours * 3600, reportedHours: hours, method: 'REPORTED' })
const fields = services => [{ ...field, services }]
test('suma múltiples servicios y acepta exactamente seis horas', () => {
  const day = attendance([], { fieldWork: fields([service('A',8,11), service('B',12,15)]) })
  assert.deepEqual(day.detectedIssues, [])
  assert.equal(day.evidence.workSummary.workedSeconds, 21600)
  assert.equal(initialReviewState(day).decision, 'JUSTIFIED')
})
test('suma oficina y campo descontando servicios coincidentes, incluso sin checada intermedia', () => {
  const day = attendance([8*3600,17*3600], { fieldWork: fields([service('A',10,13,2)]) })
  assert.equal(day.evidence.workSummary.officeSeconds, 6*3600)
  assert.equal(day.evidence.workSummary.workedSeconds, 8*3600)
  assert.deepEqual(day.evidence.workSummary.officeIntervals, [{ startSeconds: 28800, endSeconds: 36000 }, { startSeconds: 46800, endSeconds: 61200 }])
  assert.deepEqual(day.detectedIssues, [])
})
test('considera salida y regreso a oficina sin atribuir la separación como presencia', () => {
  const day = attendance([8,10,14,16].map(h=>h*3600), { fieldWork: fields([service('A',11,13)]) })
  assert.equal(day.evidence.workSummary.officeSeconds, 4*3600)
  assert.equal(day.evidence.workSummary.workedSeconds, 6*3600)
  assert.deepEqual(day.detectedIssues, [])
})
test('señala registros impares y no inventa tiempo de oficina para llegar a seis horas', () => {
  const day = attendance([8,10,15].map(h=>h*3600), { fieldWork: fields([service('A',11,13)]) })
  assert.equal(day.evidence.workSummary.officeSeconds, 0)
  assert.equal(day.evidence.workSummary.uncertainOffice, true)
  assert.ok(day.detectedIssues.includes('FIELD_DATA_REVIEW'))
})
test('no duplica una cita entre archivos y señala servicios superpuestos o contradictorios', () => {
  const entry = fields([service('A',8,14)])[0]
  assert.equal(attendance([], { fieldWork: [entry, {...entry, reportId:'second'}] }).evidence.workSummary.fieldSeconds, 21600)
  const clash = attendance([], { fieldWork: [entry, {...entry, reportId:'second', services:[service('A',8,15)]}] })
  assert.ok(clash.detectedIssues.includes('FIELD_DATA_REVIEW'))
  assert.ok(attendance([], { fieldWork: fields([service('A',8,12),service('B',11,14)]) }).detectedIssues.includes('FIELD_DATA_REVIEW'))
})
test('campo suficiente justifica checada faltante; campo insuficiente la conserva como incidencia', () => {
  const enough = attendance([28800], { fieldWork: fields([service('A',9,15)]) })
  assert.deepEqual(enough.detectedIssues, [])
  assert.equal(enough.exitSeconds, null); assert.equal(enough.exitEstimated, false)
  assert.ok(attendance([28800]).detectedIssues.includes('MISSING_EXIT'))
  assert.deepEqual(attendance([], { requests:[{ id:'vac',userId:'person',type:'VACATION',status:'PENDING_HR',approvedByBoss:true,startDate:'2026-10-12',returnDate:'2026-10-13' }] }).detectedIssues, [])
})
test('horas del Excel por día tienen prioridad; servicios de varios días usan intervalos por jornada', () => {
  const one = preview([row({ start:'2026-10-12T08:00:00', end:'2026-10-12T17:00:00', workingHours:6 })])
  assert.equal(one.days[0].services[0].workedSeconds,21600)
  const multiple = preview([row()], { workdayFor:(_, date)=>({site:'AJUSCO',startSeconds:28800,endSeconds:date==='2026-10-13'?39600:61200,ruleIds:[]}) })
  assert.deepEqual(multiple.days.map(day=>day.services[0].workedSeconds),[25200,10800,25200])
  assert.equal(multiple.days[0].services[0].account,'Prueba')
})
