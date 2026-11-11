export type FieldRecord = {
  row: number; appointment: string; workOrder: string; owner: string; status: string; workType: string
  start: string | null; end: string | null; netHours: number | null; workingHours: number | null; account: string
  rawStart: string; rawEnd: string; issues: string[]
}
export type FieldSource = { fileName: string; digest: string; sheetName: string; records: FieldRecord[]; originalFileBase64?: string }
export type FieldMapping = Record<string, { userId: string | null; reason: string }>
export type FieldCoverageMode = 'RANGE' | 'END_DAY'
export type FieldEmployee = { id: string; name: string; employeeNumber: string; isBlacklisted: boolean; entryDate: Date | string }
export type FieldDay = { userId: string; date: string; appointments: string[]; rows: number[]; entrySeconds: number | null; exitSeconds: number | null; services?: import('@/lib/attendance/types').FieldService[] }
export type FieldPreview = { days: FieldDay[]; coverageDays: FieldDay[]; errors: string[]; omitted: { row: number; appointment: string; reason: string }[]; owners: string[] }
