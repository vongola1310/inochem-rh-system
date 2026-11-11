'use client'

import { useEffect, useId, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { es } from 'date-fns/locale'
import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { calendarDays, displayDate } from '@/lib/attendance/dates'

export function DateRangeField({ initialStart = '', initialEnd = '', calendarDayCount = false }: { initialStart?: string; initialEnd?: string; calendarDayCount?: boolean }) {
  const id = useId(), [start, setStart] = useState(initialStart), [end, setEnd] = useState(initialEnd), [months, setMonths] = useState(1)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)')
    const change = () => setMonths(query.matches ? 2 : 1)
    change(); query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  let days: number | null = null
  try { if (start && end) days = calendarDays(start, end) } catch {}
  const toLocal = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00') : undefined
  const range: DateRange = { from: toLocal(start), to: toLocal(end) }
  function select(value: DateRange | undefined) {
    setStart(value?.from ? format(value.from, 'yyyy-MM-dd') : '')
    setEnd(value?.to ? format(value.to, 'yyyy-MM-dd') : '')
  }
  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor={`${id}-start`}>Fecha inicial</Label><Input id={`${id}-start`} name="startDate" type="date" required value={start} onChange={e => setStart(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor={`${id}-end`}>Fecha final (incluida)</Label><Input id={`${id}-end`} name="endDate" type="date" required min={start || undefined} value={end} onChange={e => setEnd(e.target.value)} /></div>
    </div>
    <Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="h-auto min-h-11 w-full justify-start gap-2 whitespace-normal text-left"><CalendarDays className="h-4 w-4 shrink-0" />{start && end ? `${displayDate(start)} — ${displayDate(end)}` : 'Elegir periodo en el calendario'}</Button></PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start"><Calendar mode="range" selected={range} onSelect={select} defaultMonth={range.from} locale={es} numberOfMonths={months} initialFocus classNames={{
        day_selected: 'bg-[#3e712c] text-white hover:bg-[#315a23] hover:text-white focus:bg-[#3e712c] focus:text-white',
        day_range_middle: 'aria-selected:bg-[#edf4e9] aria-selected:text-[#315a23] aria-selected:rounded-none',
      }} /></PopoverContent>
    </Popover>
    {calendarDayCount && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{days !== null ? `${days} ${days === 1 ? 'día corrido' : 'días corridos'}, incluidos fines de semana y festivos.` : 'Selecciona ambas fechas para calcular los días corridos.'}</p>}
  </div>
}
