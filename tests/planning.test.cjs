const { test } = require('node:test'), assert = require('node:assert/strict')
require('ts-node').register({ transpileOnly:true,compilerOptions:{module:'CommonJS',moduleResolution:'node'} })
const {planningMonth,planningWeek}=require('../lib/planning.ts')
const event=(id,start,end,name=id)=>({id,name,start,end,userId:id,employeeNumber:id,category:'VACATION',label:'Vacaciones',pending:false,status:'Aprobada'})
test('calendario de seis semanas, lunes a domingo, con meses y años bisiestos',()=>{
 const jan=planningMonth('2027-01','2026-11-26')
 assert.equal(jan.start,'2026-12-28');assert.equal(jan.end,'2027-02-07');assert.equal(jan.days.length,42)
 assert.equal(jan.previous,'2026-12');assert.equal(jan.next,'2027-02')
 assert.ok(planningMonth('2028-02').days.includes('2028-02-29'))
 for(const invalid of ['2027-13','hello','1800-01','2200-01'])assert.equal(planningMonth(invalid,'2026-11-26').month,'2026-11')
 assert.equal(planningMonth('1901-01').previous,'1901-01');assert.equal(planningMonth('2199-12').next,'2199-12')
})
test('las barras se cortan por semana y conservan continuidad de mes y año',()=>{
 const vacation=event('vac','2026-12-30','2027-01-08')
 const first=planningWeek([vacation],'2026-12-28').bars[0]
 assert.equal(first.column,2);assert.equal(first.span,5);assert.equal(first.continuesBefore,false);assert.equal(first.continuesAfter,true)
 const second=planningWeek([vacation],'2027-01-04').bars[0]
 assert.equal(second.column,0);assert.equal(second.span,5);assert.equal(second.continuesBefore,true);assert.equal(second.continuesAfter,false)
})
test('eventos simultáneos no se tapan y los días libres reutilizan carril',()=>{
 const result=planningWeek([event('a','2027-01-04','2027-01-06'),event('b','2027-01-05','2027-01-05'),event('c','2027-01-07','2027-01-07')],'2027-01-04')
 const [a,b,c]=['a','b','c'].map(id=>result.bars.find(bar=>bar.event.id===id))
 assert.notEqual(a.lane,b.lane);assert.equal(a.lane,c.lane)
 assert.equal(result.lanes,2)
 assert.equal(planningWeek([event('bad','2027-01-07','2027-01-01')],'2027-01-04').bars.length,0)
})
