// lib/lft-law.ts
// ============================================================
// TABLA DE VACACIONES — Ley Federal del Trabajo (reforma 2023)
// + Bono Inochem (+5 días a partir del primer año).
// Misma tabla que vacation-logic.ts / sync-balances.ts.
// ============================================================

export const INOCHEM_BONUS_DAYS = 5

/** Días que marca la LFT según los años cumplidos (sin bono). */
export function getLegalDaysByYears(years: number): number {
  if (years < 1) return 0
  if (years <= 5) return 10 + years * 2          // 1→12, 2→14, 3→16, 4→18, 5→20
  // A partir del 6º año: +2 días cada 5 años (6-10→22, 11-15→24 … 26-30→30, 31+→32)
  return Math.min(22 + Math.floor((years - 6) / 5) * 2, 32)
}

/** Días totales que le tocan (LFT + Bono Inochem). */
export function getDaysByYears(years: number): number {
  if (years < 1) return 0
  return getLegalDaysByYears(years) + INOCHEM_BONUS_DAYS
}
