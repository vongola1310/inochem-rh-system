import { matchesAttendanceCategory } from './categories'
import type { Punch, FieldWorkEvidence } from './types'

export type AttendanceDisplayDay = {
  id: string; userId: string; managerId: string | null; date: string
  user: { name: string; employeeNumber: string }; manager: { name: string } | null
  entrySeconds: number | null; exitSeconds: number | null; exitEstimated: boolean
  detectedIssues: string[]; coverage: string[]; reviewStatus: string; decision: string
  justification: string | null; managerComment: string | null; reviewNotApplicable?: boolean
  systemNotes?: string[]; punches?: Punch[]; fieldWork?: FieldWorkEvidence[]
  workSummary?: import('./field-hours').WorkSummary
}

export type AttendancePersonGroup = { userId: string; user: AttendanceDisplayDay['user']; days: AttendanceDisplayDay[] }
export type AttendanceLeaderGroup = {
  id: string; name: string; kind: 'leader' | 'notApplicable' | 'unassigned'
  people: AttendancePersonGroup[]; days: AttendanceDisplayDay[]
}

export function attendanceCounts(days: AttendanceDisplayDay[]) {
  return days.reduce((count, day) => {
    count.days++
    if (day.reviewNotApplicable) count.notApplicable++
    else {
      if (day.detectedIssues.length) count.issues++
      if (day.reviewStatus === 'WAITING_EMPLOYEE') count.employee++
      else if (day.reviewStatus === 'WAITING_MANAGER') count.manager++
      else if (day.reviewStatus === 'RESOLVED') count.resolved++
    }
    return count
  }, { days: 0, issues: 0, employee: 0, manager: 0, resolved: 0, notApplicable: 0 })
}

const normalized = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function groupAttendanceByLeader(days: AttendanceDisplayDay[], filters: { search?: string; state?: string; onlyIssues?: boolean; category?: string } = {}): AttendanceLeaderGroup[] {
  const result = new Map<string, AttendanceLeaderGroup>()
  const words = normalized(filters.search || '').trim().split(/\s+/).filter(Boolean)
  for (const day of days) {
    if (!matchesAttendanceCategory(day, filters.category)) continue
    const kind = day.reviewNotApplicable ? 'notApplicable' : day.managerId ? 'leader' : 'unassigned'
    const name = kind === 'notApplicable' ? 'N/A — No aplica' : kind === 'unassigned' ? 'Sin responsable asignado' : day.manager?.name || 'Responsable del dictamen'
    const id = kind === 'leader' ? `leader:${day.managerId}` : kind
    if (filters.onlyIssues && (day.reviewNotApplicable || !day.detectedIssues.length)) continue
    if (filters.state && filters.state !== 'all') {
      if (filters.state === 'NA' ? !day.reviewNotApplicable : day.reviewNotApplicable || (filters.state === 'WAITING_MANAGER' ? !['WAITING_EMPLOYEE', 'WAITING_MANAGER'].includes(day.reviewStatus) : day.reviewStatus !== filters.state)) continue
    }
    const text = normalized(`${name} ${day.user.name} ${day.user.employeeNumber} ${day.date} ${day.date.split('-').reverse().join('/')}`)
    if (!words.every(word => text.includes(word))) continue
    const group: AttendanceLeaderGroup = result.get(id) || { id, name, kind, people: [], days: [] }
    group.days.push(day)
    result.set(id, group)
  }
  const order = { leader: 0, unassigned: 1, notApplicable: 2 }
  return [...result.values()].map(group => {
    const people = new Map<string, AttendancePersonGroup>()
    for (const day of group.days) {
      const person: AttendancePersonGroup = people.get(day.userId) || { userId: day.userId, user: day.user, days: [] }
      person.days.push(day)
      people.set(day.userId, person)
    }
    group.people = [...people.values()].sort((a, b) => a.user.name.localeCompare(b.user.name, 'es') || a.userId.localeCompare(b.userId))
    for (const person of group.people) person.days.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    return group
  }).sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id))
}
