import * as XLSX from 'xlsx'
import { createHash } from 'node:crypto'
import { parseDate, timeSeconds } from './dates'
import type { Punch, Site, SourceFile } from './types'

const normalizeHeader = (value: unknown) => String(value ?? '').replace(/^\uFEFF/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
export const normalizeEmployeeNumber = (value: unknown) => String(value ?? '').trim().replace(/^'+/, '').trim()
const blank = (value: unknown) => value === '' || value === null || value === undefined || value === '-'

function fileDate(value: unknown): string {
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (!date) throw new Error('Fecha de Excel inválida.')
    return fileDate(`${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`)
  }
  const text = String(value).trim()
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const key = match ? `${match[3]}-${match[2]}-${match[1]}` : text
  parseDate(key)
  return key
}

function fileTime(value: unknown): number | null {
  if (blank(value)) return null
  if (typeof value === 'number') {
    if (value < 0 || value >= 1) throw new Error('Hora de Excel inválida.')
    const seconds = Math.round(value * 86400)
    if (seconds >= 86400) throw new Error('Hora fuera del día.')
    return seconds
  }
  const seconds = timeSeconds(String(value))
  if (seconds === null) throw new Error('Hora inválida. Se espera HH:mm o HH:mm:ss.')
  return seconds
}

export function parseBiocheckFile(buffer: Buffer, name: string, site: Site, start: string, end: string): SourceFile {
  if (!/\.(csv|xlsx|xls)$/i.test(name)) throw new Error('Solo se admiten archivos CSV, XLSX o XLS.')
  if (!buffer.length || buffer.length > 3 * 1024 * 1024) throw new Error('Cada archivo debe contener datos y pesar como máximo 3 MB.')
  parseDate(start); parseDate(end)
  let workbook: XLSX.WorkBook
  if (/\.csv$/i.test(name)) {
    let text: string
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer) }
    catch { text = new TextDecoder('windows-1252').decode(buffer) }
    workbook = XLSX.read(text, { type: 'string', raw: true, cellFormula: false, sheetRows: 50002 })
  } else {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, cellFormula: false, sheetRows: 50002 })
  }
  const required = site === 'AJUSCO'
    ? ['id de empleado', 'nombre', 'fecha', 'primera checada', 'ultima checada']
    : ['person id', 'name', 'time']
  const candidates = workbook.SheetNames.map(sheet => {
    const range = workbook.Sheets[sheet]['!fullref'] || workbook.Sheets[sheet]['!ref']
    if (range && XLSX.utils.decode_range(range).e.r > 50000) throw new Error('El archivo supera 50,000 filas.')
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, raw: true, defval: '', blankrows: true })
    const headers = (rows[0] || []).map(normalizeHeader)
    return { rows, headers }
  }).filter(({ headers }) => required.every(header => headers.includes(header)))
  if (candidates.length !== 1) throw new Error(`El archivo de ${site === 'AJUSCO' ? 'Ajusco' : 'Periférico'} debe tener una sola hoja con sus encabezados originales. Comprueba que no intercambiaste los archivos.`)
  const { rows, headers } = candidates[0]
  if (required.some(header => headers.filter(h => h === header).length !== 1)) throw new Error('Hay columnas obligatorias duplicadas.')
  const punches: Punch[] = [], warnings: string[] = []
  const people = new Map<string, string>(), seen = new Set<string>(), summaries = new Map<string, string>()
  let rowCount = 0, duplicateCount = 0
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index]
    if (row.every(blank)) continue
    rowCount++
    const get = (header: string) => row[headers.indexOf(header)]
    try {
      const externalId = normalizeEmployeeNumber(get(site === 'AJUSCO' ? 'id de empleado' : 'person id'))
      const personName = String(get(site === 'AJUSCO' ? 'nombre' : 'name')).trim()
      if (!externalId || externalId.length > 64 || !personName) throw new Error('Falta el número o el nombre del empleado.')
      if (people.has(externalId) && people.get(externalId) !== personName) warnings.push(`El ID ${externalId} tiene distintos nombres en el archivo.`)
      people.set(externalId, personName)
      let date: string, times: (number | null)[]
      if (site === 'AJUSCO') {
        date = fileDate(get('fecha'))
        const first = fileTime(get('primera checada')), last = fileTime(get('ultima checada'))
        if (first !== null && last !== null && last < first) throw new Error('La última checada es anterior a la primera; requiere revisión del archivo.')
        const key = `${externalId}|${date}`, signature = `${first}|${last}`
        if (summaries.has(key) && summaries.get(key) !== signature) throw new Error('Hay dos resúmenes diarios diferentes para el mismo empleado.')
        summaries.set(key, signature)
        times = first === last ? [first] : [first, last]
      } else {
        const value = get('time')
        if (typeof value === 'number') {
          const parsed = XLSX.SSF.parse_date_code(value)
          if (!parsed) throw new Error('Fecha/hora de Excel inválida.')
          date = fileDate(Math.floor(value))
          times = [parsed.H * 3600 + parsed.M * 60 + Math.round(parsed.S)]
        } else {
          const match = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/)
          if (!match) throw new Error('Se espera fecha y hora local: AAAA-MM-DD HH:mm:ss.')
          date = fileDate(match[1]); times = [fileTime(match[2])]
        }
      }
      if (date < start || date > end) throw new Error(`La fecha ${date} está fuera del periodo declarado.`)
      for (const seconds of times) {
        if (seconds === null) continue
        const key = `${externalId}|${date}|${seconds}`
        if (seen.has(key)) { duplicateCount++; continue }
        seen.add(key)
        punches.push({ externalId, name: personName, date, seconds, row: index + 1, site })
      }
    } catch (error) {
      throw new Error(`${name}, fila ${index + 1}: ${error instanceof Error ? error.message : 'Dato inválido.'}`)
    }
  }
  if (!rowCount) throw new Error('El archivo no contiene filas de asistencia.')
  if (duplicateCount) warnings.push(`${duplicateCount} marcaciones repetidas se contarán una sola vez.`)
  return { site, name, digest: createHash('sha256').update(buffer).digest('hex'), rowCount, duplicateCount,
    people: [...people].map(([externalId, name]) => ({ externalId, name })), punches, warnings: [...new Set(warnings)] }
}
