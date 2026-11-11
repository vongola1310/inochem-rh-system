const { test } = require('node:test')
const assert = require('node:assert/strict')
const XLSX = require('xlsx')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { evaluateDay, buildPreview, monthlyTotals } = require('../lib/attendance/engine.ts')
const { timeSeconds, calendarDays, datesBetween, parseDate, todayInMexico } = require('../lib/attendance/dates.ts')
const { parseBiocheckFile } = require('../lib/attendance/parser.ts')
const { REVIEWER_NOT_APPLICABLE, initialReviewState } = require('../lib/attendance/review-policy.ts')
const date = '2026-09-22'
const punch = (time, site = 'AJUSCO') => ({ externalId: '33126', name: 'Prueba', date, seconds: timeSeconds(time), row: 2, site })
const evaluate = (times, requests = [], leaves = []) => evaluateDay('employee', date, times.map(t => typeof t === 'string' ? punch(t) : t), requests, leaves, 'boss')
const permit = (type, extra = {}) => ({ id: 'request', userId: 'employee', type, status: 'PENDING_HR', approvedByBoss: true, startDate: date, returnDate: '2026-09-23', endDate: null, permitTime: null, ...extra })
const employees = [{ id: 'employee', employeeNumber: '33126', name: 'Empleado', entryDate: '2023-01-01', bossId: 'boss' }, { id: 'boss', employeeNumber: '33000', name: 'Jefe', entryDate: '2020-01-01', bossId: null }]
const config = { includedUserIds: ['employee'], excludedUsers: { boss: 'Fuera del padrón de esta prueba' }, mappings: {}, reviewers: {} }
const source = (punches, site = 'AJUSCO') => ({ site, name: 'test.csv', digest: 'test', rowCount: punches.length, duplicateCount: 0, people: [{ externalId: '33126', name: 'Prueba' }], punches, warnings: [] })
const preview = extra => buildPreview({ start: date, end: date, sources: [source([punch('08:00')])], employees, config, requests: [], leaves: [], holidays: [], ...extra })
const ajusco = 'ID de Empleado,Nombre,Departamento,Fecha,Dia de Semana,Primera Checada,Última Checada,Tiempo Total\n'
const periferico = 'Person ID,Name,Department,Time,Attendance Status\n'
const read = (text, site = 'AJUSCO') => parseBiocheckFile(Buffer.from(text), 'test.csv', site, '2026-09-22', '2026-10-06')

test('tolerancia: 08:10:59 es puntual y 08:11:00 es retardo', () => {
  assert.deepEqual(evaluate(['08:10:59', '17:00']).detectedIssues, [])
  assert.deepEqual(evaluate(['08:11:00', '17:00']).detectedIssues, ['LATE'])
  assert.equal(evaluate(['08:11:00']).lateMinutes, 11)
})
test('una entrada sin salida genera incidencia y no inventa una salida', () => {
  const row = evaluate(['07:59'])
  assert.equal(row.exitSeconds, null)
  assert.equal(row.exitEstimated, false)
  assert.deepEqual(row.detectedIssues, ['MISSING_EXIT'])
})
test('una sola marcación a partir de las 17:00 requiere aclarar entrada, sin inventarla', () => {
  const row = evaluate(['17:12'])
  assert.equal(row.entrySeconds, null)
  assert.equal(row.exitSeconds, timeSeconds('17:12'))
  assert.equal(row.exitEstimated, false)
  assert.deepEqual(row.detectedIssues, ['MISSING_ENTRY'])
})
test('sin entrada ni salida se muestra Falta, sin inventar salida y pendiente de dictamen del jefe', () => {
  const row = evaluate([])
  assert.deepEqual(row.detectedIssues, ['ABSENCE'])
  assert.equal(require('../lib/attendance/types.ts').ISSUE_LABELS[row.detectedIssues[0]], 'Falta')
  assert.equal(row.entrySeconds, null)
  assert.equal(row.exitSeconds, null)
  assert.equal(row.exitEstimated, false)
  assert.deepEqual(initialReviewState(row), { reviewStatus: 'WAITING_MANAGER', decision: 'PENDING' })
})
test('combina ambas sedes antes de escoger entrada y salida y conserva las dos fuentes', () => {
  const result = preview({ sources: [source([punch('07:59')]), source([punch('18:02', 'PERIFERICO')], 'PERIFERICO')] })
  assert.equal(result.errors.length, 0)
  assert.equal(result.days.length, 1)
  assert.equal(result.days[0].entrySeconds, timeSeconds('07:59'))
  assert.equal(result.days[0].exitSeconds, timeSeconds('18:02'))
  assert.equal(result.days[0].exitEstimated, false)
  assert.equal(result.days[0].evidence.punches.length, 2)
})
test('vacaciones con firma del jefe y RH pendiente cubren hasta antes del regreso', () => {
  assert.deepEqual(evaluate([], [permit('VACATION')]).detectedIssues, [])
  assert.deepEqual(evaluateDay('employee', '2026-09-23', [], [permit('VACATION')], [], 'boss').detectedIssues, ['ABSENCE'])
})
test('solicitudes sin firma, canceladas o rechazadas no justifican; cancelación solicitada sigue vigente', () => {
  for (const changes of [{ approvedByBoss: false }, { status: 'PENDING_BOSS' }, { status: 'CANCELLED' }, { status: 'REJECTED' }]) assert.deepEqual(evaluate([], [permit('VACATION', changes)]).detectedIssues, ['ABSENCE'])
  assert.deepEqual(evaluate([], [permit('VACATION', { status: 'CANCELLATION_REQUESTED' })]).detectedIssues, [])
})
test('Home Office, ausencia completa y cumpleaños firmados cubren el día sin checadas', () => {
  for (const type of ['PERMIT_HOME_OFFICE', 'PERMIT_ABSENCE', 'PERMIT_BIRTHDAY']) assert.deepEqual(evaluate([], [permit(type)]).detectedIssues, [])
})
test('un permiso de llegada no autoriza una falta completa ni una llegada posterior al horario firmado', () => {
  const request = permit('PERMIT_LATE', { permitTime: '10:30 AM' })
  assert.deepEqual(evaluate([], [request]).detectedIssues, ['ABSENCE'])
  assert.deepEqual(evaluate(['10:30', '17:00'], [request]).detectedIssues, [])
  assert.deepEqual(evaluate(['10:31', '17:00'], [request]).detectedIssues, ['LATE'])
})
test('permiso de salida solo cubre su horario; texto ambiguo requiere dictamen', () => {
  assert.deepEqual(evaluate(['08:00', '15:00'], [permit('PERMIT_EARLY', { permitTime: '15:00' })]).detectedIssues, [])
  assert.deepEqual(evaluate(['08:00', '14:59'], [permit('PERMIT_EARLY', { permitTime: '15:00' })]).detectedIssues, ['EARLY_EXIT'])
  assert.ok(evaluate(['10:00'], [permit('PERMIT_LATE', { permitTime: 'por la mañana' })]).detectedIssues.includes('PERMISSION_REVIEW'))
  assert.ok(evaluate(['08:00'], [permit('PERMIT_OTHER')]).detectedIssues.includes('PERMISSION_REVIEW'))
})
test('incapacidad inclusiva cubre el último día, cancelada no cubre y días corridos incluyen bisiestos', () => {
  const leave = { id: 'leave', userId: 'employee', startDate: '2026-09-20', endDate: date, cancelledAt: null }
  assert.deepEqual(evaluate([], [], [leave]).detectedIssues, [])
  assert.deepEqual(evaluate([], [], [{ ...leave, cancelledAt: new Date() }]).detectedIssues, ['ABSENCE'])
  assert.equal(calendarDays('2028-02-28', '2028-03-01'), 3)
  assert.equal(calendarDays('2026-09-25', '2026-09-28'), 4)
})
test('no genera faltas en fines de semana, festivos ni antes de contratación', () => {
  const result = preview({ start: '2026-09-25', end: '2026-09-29', holidays: ['2026-09-28'], sources: [] })
  assert.deepEqual(result.days.map(d => d.date), ['2026-09-25', '2026-09-29'])
  assert.equal(preview({ employees: [{ ...employees[0], entryDate: '2026-09-23' }, employees[1]] }).days.length, 0)
})
test('excluir usuarios requiere motivo y no genera sus faltas; sin jefe se bloquea publicar incidencias', () => {
  assert.ok(preview({ config: { ...config, excludedUsers: {} } }).errors.some(e => e.includes('excluye')))
  assert.ok(preview({ sources: [], employees: [{ ...employees[0], bossId: null }, employees[1]] }).errors.some(e => e.includes('responsable')))
  assert.ok(preview({ config: { ...config, reviewers: { employee: 'employee' } } }).errors.some(e => e.includes('otro responsable')))
})
test('IDs desconocidos se bloquean hasta vincular o excluir explícitamente con motivo', () => {
  const unknown = { ...source([]), people: [{ externalId: '00', name: 'Desconocido' }] }
  assert.ok(preview({ sources: [unknown] }).errors.some(e => e.includes('ID 00')))
  assert.equal(preview({ sources: [unknown], config: { ...config, mappings: { 'AJUSCO:00': { userId: null, reason: 'Personal externo no incluido' } } } }).errors.length, 0)
})

test('N/A sustituye al jefe del perfil, conserva checadas y excluye del proceso sin cambiar el padrón', () => {
  const result = preview({ sources: [source([punch('08:11')])], config: { ...config, reviewers: { employee: REVIEWER_NOT_APPLICABLE } } })
  assert.deepEqual(result.errors, [])
  const day = result.days[0]
  assert.equal(day.managerId, null)
  assert.equal(day.entrySeconds, timeSeconds('08:11'))
  assert.equal(day.exitSeconds, null)
  assert.equal(day.evidence.punches.length, 1)
  assert.equal(day.evidence.reviewNotApplicable, true)
  assert.deepEqual(day.detectedIssues, ['LATE', 'MISSING_EXIT'], 'Conserva la observación original como evidencia')
  assert.deepEqual(initialReviewState(day), { reviewStatus: 'RESOLVED', decision: 'NONE' })
  assert.equal(preview().days[0].managerId, 'boss', 'No altera otras configuraciones')
})

test('N/A sin jefe conserva días sin checadas y permite volver a exigir dictamen al seleccionar responsable', () => {
  const noBoss = [{ ...employees[0], bossId: null }, employees[1]]
  const result = preview({ employees: noBoss, sources: [], config: { ...config, reviewers: { employee: REVIEWER_NOT_APPLICABLE } } })
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.days[0].detectedIssues, ['ABSENCE'])
  assert.equal(result.days[0].entrySeconds, null)
  assert.equal(initialReviewState(result.days[0]).reviewStatus, 'RESOLVED')
  const assigned = preview({ employees: noBoss, sources: [], config: { ...config, reviewers: { employee: 'boss' } } })
  assert.equal(assigned.days[0].evidence.reviewNotApplicable, undefined)
  assert.equal(initialReviewState(assigned.days[0]).reviewStatus, 'WAITING_MANAGER')
  assert.ok(preview({ config: { ...config, reviewers: { employee: 'inexistente' } } }).errors.length)
})

test('N/A no acumula retardos, faltas, equivalencias, justificaciones ni pendientes', () => {
  const rows = ['2026-09-22', '2026-09-23', '2026-09-24'].map(date => ({ userId: 'employee', date, decision: 'LATE', reviewStatus: 'RESOLVED', evidence: { reviewNotApplicable: true } }))
  rows.push({ ...rows[0], date: '2026-09-25', decision: 'ABSENCE', needsRefresh: true })
  const [total] = monthlyTotals(rows)
  assert.equal(total.days, 4); assert.equal(total.notApplicable, 4)
  for (const field of ['late', 'absences', 'incidents', 'justified', 'pending']) assert.equal(total[field], 0, field)
})
test('mantiene los retardos sin convertirlos en faltas y sin contar pendientes', () => {
  const rows = ['2026-09-22', '2026-09-23', '2026-09-24', '2026-10-01'].map(date => ({ userId: 'employee', date, decision: 'LATE', reviewStatus: 'RESOLVED' }))
  rows.push({ userId: 'employee', date: '2026-09-25', decision: 'ABSENCE', reviewStatus: 'RESOLVED' })
  rows.push({ userId: 'employee', date: '2026-09-28', decision: 'LATE', reviewStatus: 'WAITING_MANAGER' })
  rows.push({ userId: 'other', date: '2026-09-22', decision: 'LATE', reviewStatus: 'RESOLVED' })
  const totals = monthlyTotals(rows), september = totals.find(t => t.userId === 'employee' && t.month === '2026-09')
  assert.equal(september.late, 3); assert.equal('equivalentAbsences' in september, false)
  assert.equal(september.absences, 1); assert.equal(september.pending, 1)
  assert.equal(totals.find(t => t.month === '2026-10').late, 1)
  assert.equal(totals.find(t => t.userId === 'other').late, 1)
  assert.throws(() => monthlyTotals([rows[0], rows[0]]), /duplicado/)
})
test('un dictamen desactualizado no cuenta como falta o retardo confirmado', () => {
  const totals = monthlyTotals([{ userId: 'employee', date, decision: 'ABSENCE', reviewStatus: 'RESOLVED', needsRefresh: true }])
  assert.equal(totals[0].absences, 0); assert.equal(totals[0].pending, 1)
})
test('lector Ajusco reconoce acentos y primera/última iguales como una sola marcación', () => {
  const data = read(ajusco + '33126,"Prueba, Nombre",Sistemas,2026-09-22,Martes,08:00,08:00,0.0')
  assert.equal(data.punches.length, 1); assert.equal(data.people[0].name, 'Prueba, Nombre')
})
test('lector Periférico elimina apóstrofo de Excel pero conserva ceros iniciales', () => {
  const data = read(periferico + "'00,Prueba,General,2026-09-22 08:10:59,None", 'PERIFERICO')
  assert.equal(data.punches[0].externalId, '00'); assert.equal(data.punches[0].seconds, timeSeconds('08:10:59'))
})
test('elimina duplicados exactos y rechaza resúmenes contradictorios', () => {
  const line = '33126,Prueba,General,2026-09-22,Martes,08:00,17:00,9'
  assert.equal(read(ajusco + line + '\n' + line).duplicateCount, 2)
  assert.throws(() => read(ajusco + line + '\n' + line.replace('08:00', '09:00')), /diferentes/)
})
test('rechaza fechas imposibles, horas inválidas, periodo equivocado y archivos intercambiados', () => {
  for (const line of ['33126,Prueba,G,2026-09-31,M,08:00,17:00,9', '33126,Prueba,G,2026-09-22,M,25:00,17:00,9', '33126,Prueba,G,2026-10-07,M,08:00,17:00,9', '33126,Prueba,G,2026-09-22,M,17:00,08:00,9']) assert.throws(() => read(ajusco + line))
  assert.throws(() => read(periferico + '33126,Prueba,G,2026-09-22 08:00:00,None'))
  assert.throws(() => parseDate('2026-02-29'))
  assert.throws(() => datesBetween('2026-01-01', '2026-12-31'))
})
test('lee Excel real con fechas y horas numéricas como los CSV, sin desplazar fechas por zona horaria', () => {
  const book = XLSX.utils.book_new()
  const serial = (Date.UTC(2026, 8, 22) - Date.UTC(1899, 11, 30)) / 86400000
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['ID de Empleado', 'Nombre', 'Fecha', 'Primera Checada', 'Última Checada'],
    ['33126', 'Prueba', serial, 8 / 24, 17 / 24],
  ]), 'Checadas')
  for (const bookType of ['xlsx', 'xls']) {
    const data = parseBiocheckFile(XLSX.write(book, { type: 'buffer', bookType }), 'test.' + bookType, 'AJUSCO', date, date)
    assert.equal(data.punches[0].date, date); assert.equal(data.punches[0].seconds, 28800); assert.equal(data.punches[1].seconds, 61200)
  }
  assert.equal(todayInMexico(new Date('2026-10-23T03:00:00Z')), '2026-10-22')
})

test('lista negra excluye faltas y checadas aunque el padrón antiguo lo incluya o intente remapear su ID', () => {
  const roster = [{ ...employees[0], isBlacklisted: true }, employees[1]]
  for (const sources of [[], [source([punch('08:30')])]]) {
    const result = preview({ employees: roster, sources })
    assert.deepEqual(result.errors, [])
    assert.deepEqual(result.days, [])
    if (sources.length) assert.equal(result.identities[0].excluded, true)
  }
  const remapped = preview({ employees: roster, config: { ...config, mappings: { 'AJUSCO:33126': { userId: 'boss', reason: 'Intento de volver a incluir la checada' } } } })
  assert.deepEqual(remapped.days, [])
  assert.equal(remapped.identities[0].excluded, true)
  assert.ok(preview({ employees: [employees[0], { ...employees[1], isBlacklisted: true }] }).errors.some(error => error.includes('otro responsable')))
})

test('jornada reducida por sede, ambas sedes y tolerancia relativa al horario', () => {
  const { resolveWorkday } = require('../lib/attendance/workday.ts')
  const rule = {id:'short',startDate:date,endDate:date,site:'AJUSCO',startSeconds:9*3600,endSeconds:11*3600}
  const schedule = resolveWorkday(date,'AJUSCO',[rule])
  assert.deepEqual(evaluateDay('employee',date,[punch('09:10:59'),punch('11:00')],[],[],'boss',schedule).detectedIssues,[])
  assert.deepEqual(evaluateDay('employee',date,[punch('09:11'),punch('11:00')],[],[],'boss',schedule).detectedIssues,['LATE'])
  assert.deepEqual(evaluateDay('employee',date,[punch('09:00')],[],[],'boss',schedule).detectedIssues,['MISSING_EXIT'])
  assert.equal(resolveWorkday(date,'PERIFERICO',[rule]).endSeconds,61200)
  assert.equal(resolveWorkday(date,null,[rule]).ambiguous,true)
  assert.equal(resolveWorkday(date,null,[{...rule,site:'BOTH'}]).ambiguous,false)
  assert.ok(preview({sources:[],schedules:[rule]}).errors.some(e=>e.includes('sede')))
  assert.equal(preview({sources:[],schedules:[rule],config:{...config,sites:{employee:'AJUSCO'}}}).errors.length,0)
  assert.equal(preview({sources:[],schedules:[rule],config:{...config,reviewers:{employee:REVIEWER_NOT_APPLICABLE}}}).errors.length,0)
})
test('el periodo cuenta fechas hábiles una vez, no empleado-días', () => {
  const result = preview({start:'2026-09-25',end:'2026-09-29',holidays:['2026-09-28'],sources:[],config:{...config,includedUserIds:['employee','boss'],excludedUsers:{},reviewers:{boss:REVIEWER_NOT_APPLICABLE}}})
  assert.equal(result.days.length,4)
  assert.deepEqual(result.period,{start:'2026-09-25',end:'2026-09-29',businessDays:2})
})
