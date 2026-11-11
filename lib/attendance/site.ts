import type { Employee, ImportConfiguration, Site, SourceFile } from './types'

export function attendanceSites(sources: SourceFile[], employees: Employee[], config: ImportConfiguration) {
  const byNumber = new Map(employees.map(employee => [employee.employeeNumber, employee.id]))
  const identities = new Map<string, Set<Site>>(), observed = new Map<string, Set<Site>>()
  const first = new Map<string, { seconds: number; site: Site }>()
  for (const source of sources) {
    const who = (externalId: string) => {
      const key = source.site + ':' + externalId
      return Object.hasOwn(config.mappings, key) ? config.mappings[key].userId : byNumber.get(externalId)
    }
    for (const person of source.people) {
      const userId = who(person.externalId)
      if (userId) identities.set(userId, new Set([...(identities.get(userId) || []), source.site]))
    }
    for (const punch of source.punches) {
      const userId = who(punch.externalId)
      if (!userId) continue
      observed.set(userId, new Set([...(observed.get(userId) || []), source.site]))
      const key = userId + '|' + punch.date, before = first.get(key)
      if (!before || punch.seconds < before.seconds) first.set(key, { seconds: punch.seconds, site: source.site })
    }
  }
  return (userId: string, date: string): Site | null => {
    if (config.sites?.[userId]) return config.sites[userId]
    if (first.has(userId + '|' + date)) return first.get(userId + '|' + date)!.site
    const sites = observed.get(userId) || identities.get(userId)
    return sites?.size === 1 ? [...sites][0] : null
  }
}
