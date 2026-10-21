/** Ciclo de aniversario vigente según el día de negocio en Ciudad de México. */
export function getCycleBounds(entryDate: Date, asOf = new Date()): { cycleStart: Date; cycleEnd: Date } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(asOf)
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value)
  const today = new Date(Date.UTC(part('year'), part('month') - 1, part('day')))
  const anniversary = new Date(Date.UTC(today.getUTCFullYear(), entryDate.getUTCMonth(), entryDate.getUTCDate()))
  const startYear = anniversary <= today ? today.getUTCFullYear() : today.getUTCFullYear() - 1
  return {
    cycleStart: new Date(Date.UTC(startYear, entryDate.getUTCMonth(), entryDate.getUTCDate())),
    cycleEnd: new Date(Date.UTC(startYear + 1, entryDate.getUTCMonth(), entryDate.getUTCDate())),
  }
}
