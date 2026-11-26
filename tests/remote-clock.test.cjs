const { test } = require('node:test')
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path')
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { remoteClockTime, validateClockPhoto } = require('../lib/remote-clock.ts')
const { evaluateDay, buildPreview } = require('../lib/attendance/engine.ts')
const { timeSeconds } = require('../lib/attendance/dates.ts')
const { resolveWorkday } = require('../lib/attendance/workday.ts')
const date = '2026-11-26'
const punch = (kind,time) => ({ id: kind, userId:'remote',date,kind,seconds:timeSeconds(time),recordedAt:date+'T18:00:00.000Z' })
const evaluate = (punches, requests=[]) => evaluateDay('remote',date,[],requests,[],'boss',undefined,punches)

test('hora oficial de México conserva la fecha correcta al cruzar medianoche UTC', () => {
  const value = remoteClockTime(new Date('2026-11-27T05:59:59Z'))
  assert.equal(value.date.toISOString(), '2026-11-26T00:00:00.000Z')
  assert.equal(value.seconds,86399)
  assert.equal(remoteClockTime(new Date('2026-11-27T06:00:00Z')).seconds,0)
})
test('foto obligatoria JPEG, dimensiones y tamaño acotados', () => {
  validateClockPhoto(fs.readFileSync(path.join(__dirname,'fixtures/remote-clock.jpg')))
  for (const bytes of [Buffer.from('<svg>hello</svg>'),Buffer.alloc(500001),Buffer.from([255,216,255,217])]) assert.throws(()=>validateClockPhoto(bytes))
})
test('entrada y salida remotas aplican tolerancia y horario sin biochecadores', () => {
  assert.deepEqual(evaluate([punch('ENTRY','08:10:59'),punch('EXIT','17:00')]).detectedIssues,[])
  assert.deepEqual(evaluate([punch('ENTRY','08:11'),punch('EXIT','16:00')]).detectedIssues,['LATE','EARLY_EXIT'])
  assert.deepEqual(evaluate([punch('ENTRY','08:00')]).detectedIssues,['MISSING_EXIT'])
  assert.deepEqual(evaluate([punch('EXIT','16:00')]).detectedIssues,['MISSING_ENTRY','EARLY_EXIT'])
  assert.deepEqual(evaluate([]).detectedIssues,['ABSENCE'])
  const lateEntry = evaluate([punch('ENTRY','18:00')])
  assert.equal(lateEntry.entrySeconds,64800,'Una entrada explícita después de las 17 no se convierte en salida')
  assert.equal(lateEntry.exitSeconds,null)
})
test('se combinan checadas físicas y remotas, respetando autorizaciones y jornada reducida', () => {
  const physical = [{externalId:'1',name:'QA',date,seconds:61200,row:2,site:'AJUSCO'}]
  assert.deepEqual(evaluateDay('remote',date,physical,[],[],'boss',undefined,[punch('ENTRY','08:00')]).detectedIssues,[])
  const permission = {id:'p',userId:'remote',type:'PERMIT_ABSENCE',status:'PENDING_HR',approvedByBoss:true,startDate:date,returnDate:null,endDate:null,permitTime:null}
  assert.deepEqual(evaluate([], [permission]).detectedIssues,[])
  const workday = resolveWorkday(date,'AJUSCO',[{id:'short',startDate:date,endDate:date,site:'AJUSCO',startSeconds:28800,endSeconds:39600}])
  assert.deepEqual(evaluateDay('remote',date,[],[],[],'boss',workday,[punch('ENTRY','08:00'),punch('EXIT','11:00')]).detectedIssues,[])
})
test('el padrón incluye al remoto aunque no exista en los archivos, y conserva evidencia de foto', () => {
  const input = {start:date,end:date,sources:[],employees:[{id:'remote',employeeNumber:'R1',name:'QA',entryDate:'2020-01-01',bossId:'boss'},{id:'boss',employeeNumber:'B1',name:'Boss',entryDate:'2020-01-01',bossId:null}],requests:[],leaves:[],holidays:[],config:{includedUserIds:['remote'],excludedUsers:{boss:'Fuera de prueba'},mappings:{},reviewers:{}},remotePunches:[punch('ENTRY','08:00'),punch('EXIT','17:00')]}
  const preview=buildPreview(input)
  assert.deepEqual(preview.errors,[])
  assert.deepEqual(preview.days[0].detectedIssues,[])
  assert.equal(preview.days[0].evidence.remotePunches.length,2)
  assert.equal(buildPreview({...input,holidays:[date]}).days.length,0)
  assert.equal(buildPreview({...input,employees:input.employees.map(e=>({...e,isBlacklisted:e.id==='remote'}))}).days.length,0)
})
