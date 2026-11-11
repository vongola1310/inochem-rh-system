import { dateKey } from './dates'
import type { Site } from './types'

export type ReducedSchedule = { id: string; startDate: Date | string; endDate: Date | string; site: string; startSeconds: number; endSeconds: number }
export type Workday = { site: Site | null; startSeconds: number; endSeconds: number; ruleIds: string[]; ambiguous?: boolean }
export const SITE_LABELS: Record<string, string> = { AJUSCO: 'Ajusco', PERIFERICO: 'Periférico', BOTH: 'Ambas sedes' }
export function resolveWorkday(date: string, site: Site | null = null, schedules: ReducedSchedule[] = []): Workday {
  const forSite = (value: Site) => {
    const matches = schedules.filter(rule => (rule.site === value || rule.site === 'BOTH') && dateKey(rule.startDate) <= date && dateKey(rule.endDate) >= date)
    return { site: value, startSeconds: matches[0]?.startSeconds ?? 28800, endSeconds: matches[0]?.endSeconds ?? 61200, ruleIds: matches.map(rule => rule.id).sort(), ambiguous: matches.length > 1 }
  }
  if (site) return forSite(site)
  const ajusco = forSite('AJUSCO'), periferico = forSite('PERIFERICO')
  return { site: null, startSeconds: ajusco.startSeconds, endSeconds: ajusco.endSeconds,
    ruleIds: [...new Set([...ajusco.ruleIds, ...periferico.ruleIds])].sort(),
    ambiguous: ajusco.ambiguous || periferico.ambiguous || ajusco.startSeconds !== periferico.startSeconds || ajusco.endSeconds !== periferico.endSeconds }
}
