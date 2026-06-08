import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Formatea una fecha de la BD (UTC) sin desfase de timezone.
 * Usa esto para FECHAS sin hora (startDate, returnDate, entryDate, holidays).
 * 
 * Problema: La BD guarda "2026-03-30T00:00:00Z" (UTC).
 *           format() de date-fns usa hora local del servidor.
 *           En México (UTC-6) lo muestra como "29 de marzo" en vez de "30 de marzo".
 * 
 * Solución: Extraemos año/mes/día en UTC y creamos un Date local con esos valores.
 */
export function formatUTC(date: Date | string, fmt: string): string {
  const d = new Date(date)
  const utc = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return format(utc, fmt, { locale: es })
}

/**
 * Formatea un timestamp de la BD (createdAt, approvalDate) en hora de México.
 * Usa esto para FECHAS CON HORA.
 */
export function formatMXTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const defaults: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options
  }
  return new Date(date).toLocaleString('es-MX', defaults)
}

/**
 * Formatea un timestamp en hora de México, solo fecha (sin hora).
 */
export function formatMXDate(date: Date | string): string {
  return new Date(date).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}