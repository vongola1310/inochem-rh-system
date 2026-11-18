export function medicalIdentifier(leave: { series: string; folio: string }): string {
  return [leave.series.trim(), leave.folio.trim()].filter(Boolean).join(' ')
}
