import { createHash } from 'node:crypto'
import * as XLSX from 'xlsx'
import { parseDate, timeSeconds } from '@/lib/attendance/dates'
import type { FieldRecord, FieldSource } from './types'

const HEADERS = ['Work Order Number', 'Appointment Number', 'Owner: Full Name', 'Actual End', 'Start Date', 'Status', 'Work Type: Work Type Name', 'Actual Duration (Net Hours)', 'Working Hours', 'Account: Account Name']
const text = (value: unknown) => String(value ?? '').trim()
function timestamp(value: unknown, date1904: boolean): string | null {
  if (value === '' || value === null || value === undefined) return null
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value, { date1904 })
    if (!parsed) throw new Error('Fecha numérica inválida')
    const date = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    parseDate(date)
    return `${date}T${[parsed.H, parsed.M, parsed.S].map(n => String(n).padStart(2, '0')).join(':')}`
  }
  const match = text(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)$/i)
  if (!match) throw new Error('Usa las fechas originales de Salesforce (día/mes/año y hora).')
  const date = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`, seconds = timeSeconds(match[4])
  parseDate(date)
  if (seconds === null) throw new Error('Hora inválida')
  return `${date}T${[Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(n => String(n).padStart(2, '0')).join(':')}`
}
export function parseFieldReport(buffer: Buffer, fileName: string): FieldSource {
  if (!/\.xlsx?$/i.test(fileName)) throw new Error('Carga el Excel original de Salesforce (.xlsx o .xls).')
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const matches = workbook.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: '', raw: true }) }))
    .filter(sheet => sheet.rows.length && HEADERS.every(header => sheet.rows[0].map(text).includes(header)))
  if (matches.length !== 1) throw new Error('El archivo debe contener una sola tabla con los encabezados originales del reporte SA_RH de Salesforce.')
  const { name: sheetName, rows } = matches[0]
  if (rows.length > 20001) throw new Error('El reporte supera las 20,000 filas permitidas.')
  const indexes = HEADERS.map(header => rows[0].map(text).indexOf(header))
  const records: FieldRecord[] = []
  for (let index = 1; index < rows.length; index++) {
    const values = indexes.map(column => rows[index][column])
    if (values.every(value => !text(value))) continue
    const [workOrder, appointment, owner, rawEnd, rawStart, status, workType, netHours, workingHours, account] = values
    const issues: string[] = []
    let start: string | null = null, end: string | null = null
    try { start = timestamp(rawStart, !!workbook.Workbook?.WBProps?.date1904); end = timestamp(rawEnd, !!workbook.Workbook?.WBProps?.date1904) } catch { issues.push('Fecha u hora inválida') }
    if (!text(owner) || !text(appointment)) issues.push('Falta responsable o número de cita')
    if (!start || !end) issues.push('Faltan fechas de inicio o fin')
    if (start && end && end < start) issues.push('La fecha de fin es anterior al inicio')
    const number = (value: unknown) => text(value) !== '' && Number.isFinite(Number(value)) ? Number(value) : null
    records.push({ row: index + 1, workOrder: text(workOrder), appointment: text(appointment), owner: text(owner), rawStart: text(rawStart), rawEnd: text(rawEnd),
      status: text(status), workType: text(workType), netHours: number(netHours), workingHours: number(workingHours), account: text(account), start, end, issues })
  }
  if (!records.length) throw new Error('El reporte no contiene servicios.')
  const counts = new Map<string, number>()
  for (const row of records) if (row.appointment) counts.set(row.appointment, (counts.get(row.appointment) || 0) + 1)
  for (const row of records) if ((counts.get(row.appointment) || 0) > 1) row.issues.push('Cita duplicada en el archivo; corrige el origen')
  return { fileName, sheetName, digest: createHash('sha256').update(buffer).digest('hex'), records }
}
