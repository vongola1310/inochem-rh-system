import { differenceInYears, addYears, setYear, isBefore, format } from 'date-fns'
import { es } from 'date-fns/locale'

// Calcular días totales (Ley + Bono Inochem)
export function calculateVacationDays(entryDate: Date): number {
  const yearsWorked = differenceInYears(new Date(), entryDate)
  
  let days = 0;
  // Ley Federal
  if (yearsWorked < 1) days = 0;
  else if (yearsWorked === 1) days = 12;
  else if (yearsWorked === 2) days = 14;
  else if (yearsWorked === 3) days = 16;
  else if (yearsWorked === 4) days = 18;
  else if (yearsWorked === 5) days = 20;
  else if (yearsWorked >= 6 && yearsWorked <= 10) days = 22;
  else if (yearsWorked >= 11 && yearsWorked <= 15) days = 24;
  else if (yearsWorked >= 16 && yearsWorked <= 20) days = 26;
  else if (yearsWorked >= 21 && yearsWorked <= 25) days = 28;
  else if (yearsWorked >= 26 && yearsWorked <= 30) days = 30;
  else days = 32;

  // Bono Inochem (+5 días si tiene al menos 1 año)
  if (yearsWorked >= 1) return days + 5;
  
  return days;
}

// Calcular el texto de vigencia (Ej: "13 oct 2024 - 13 oct 2025")
export function getCyclePeriod(entryDate: Date) {
  const today = new Date()
  const currentYear = today.getFullYear()
  
  let cycleStart = setYear(entryDate, currentYear)
  if (isBefore(today, cycleStart)) {
    cycleStart = addYears(cycleStart, -1)
  }
  const cycleEnd = addYears(cycleStart, 1)

  return {
    start: cycleStart,
    end: cycleEnd,
    label: `${format(cycleStart, "dd MMM yyyy", { locale: es })} - ${format(cycleEnd, "dd MMM yyyy", { locale: es })}`
  }
}