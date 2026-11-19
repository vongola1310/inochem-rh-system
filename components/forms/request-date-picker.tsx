'use client'

import { useId, useRef, useState } from 'react'
import { DayProps, useDayPicker, useDayRender } from 'react-day-picker'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { calendarDate, calendarKey } from '@/lib/request-dates'
import { todayInMexico } from '@/lib/attendance/dates'

type Props = {
  label: string
  value?: Date
  onChange: (date: Date | undefined) => void
  holidays: { date: string; name: string }[]
  disabled?: boolean
  after?: Date
  rangeStart?: Date
  rangeEnd?: Date
  hint?: string
}

function AccessibleDay({ date, displayMonth }: DayProps) {
  const ref = useRef<HTMLButtonElement>(null)
  const day = useDayRender(date, displayMonth, ref)
  const { labels, locale } = useDayPicker()
  if (day.isHidden) return <div role="gridcell" />
  return <button {...day.buttonProps} ref={ref} type="button" name="day" aria-label={labels.labelDay(date, day.activeModifiers, { locale })} />
}

export function RequestDatePicker({ label, value, onChange, holidays, disabled, after, rangeStart, rangeEnd, hint }: Props) {
  const id = useId()
  const today = calendarDate(todayInMexico())
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(value || after || today)
  const holidayMap = new Map(holidays.map(h => [h.date.slice(0, 10), h.name]))
  const unavailable = (date: Date) => date.getDay() === 0 || date.getDay() === 6 || holidayMap.has(calendarKey(date)) || Boolean(after && calendarKey(date) <= calendarKey(after))
  const moveMonth = (offset: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1, 12))
  const startKey = rangeStart && calendarKey(rangeStart), endKey = rangeEnd && calendarKey(rangeEnd)
  const monthHolidays = holidays.filter(h => h.date.slice(0, 7) === calendarKey(month).slice(0, 7))
  return <div className="min-w-0 space-y-2">
    <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</label>
    <Popover open={open} onOpenChange={next => { if (next) setMonth(value || after || today); setOpen(next) }}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" disabled={disabled} aria-describedby={hint ? `${id}-hint` : undefined}
          className="h-auto min-h-14 w-full justify-start gap-3 whitespace-normal rounded-xl border-slate-300 px-3 py-3 text-left font-normal hover:border-[#527346] hover:bg-[#edf4e9]">
          <CalendarDays className="h-5 w-5 shrink-0 text-[#3e712c]" />
          <span className={value ? 'capitalize text-slate-900' : 'text-slate-500'}>{value ? format(value, 'EEEE d MMM yyyy', { locale: es }) : 'Selecciona una fecha'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label={label} align="start" collisionPadding={12} className="w-[328px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-2xl p-3 shadow-xl" style={{ maxHeight: 'var(--radix-popover-content-available-height)' }}>
        <p className="mb-3 text-sm font-semibold text-slate-900">{label}</p>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label="Mes anterior" disabled={month.getFullYear() === 1900 && month.getMonth() === 0} onClick={() => moveMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <select aria-label="Mes" value={month.getMonth()} onChange={e => setMonth(new Date(month.getFullYear(), Number(e.target.value), 1, 12))} className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-1 text-sm capitalize">
            {Array.from({ length: 12 }, (_, m) => <option key={m} value={m}>{format(new Date(2026, m, 1), 'MMMM', { locale: es })}</option>)}
          </select>
          <select aria-label="Año" value={month.getFullYear()} onChange={e => setMonth(new Date(Number(e.target.value), month.getMonth(), 1, 12))} className="h-10 w-20 rounded-lg border border-slate-200 bg-white px-1 text-sm">
            {Array.from({ length: 301 }, (_, i) => 1900 + i).map(year => <option key={year}>{year}</option>)}
          </select>
          <Button type="button" variant="ghost" size="icon" aria-label="Mes siguiente" disabled={month.getFullYear() === 2200 && month.getMonth() === 11} onClick={() => moveMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Calendar mode="single" selected={value} month={month} onMonthChange={setMonth} today={today} locale={es} weekStartsOn={1} fixedWeeks showOutsideDays={false}
          fromYear={1900} toYear={2200} components={{ Day: AccessibleDay }}
          onSelect={date => { if (date && !unavailable(date)) { onChange(date); setOpen(false) } }} disabled={unavailable}
          modifiers={{ holiday: date => holidayMap.has(calendarKey(date)), period: date => Boolean(startKey && endKey && calendarKey(date) >= startKey && calendarKey(date) < endKey) }}
          modifiersClassNames={{ holiday: '!text-amber-700 !opacity-100 underline decoration-dotted', period: 'bg-green-50 font-semibold' }}
          labels={{ labelDay: date => `${format(date, 'EEEE d MMMM yyyy', { locale: es })}${holidayMap.has(calendarKey(date)) ? `, ${holidayMap.get(calendarKey(date))}` : ''}` }}
          className="mt-2 border-0 p-0 shadow-none"
          classNames={{ caption: 'sr-only', nav: 'hidden', month: 'space-y-2 w-full', months: 'w-full', head_row: 'flex w-full', head_cell: 'w-[14.2857%] text-xs font-medium text-slate-500', row: 'flex w-full mt-1', cell: 'relative w-[14.2857%] p-0 text-center', day: 'h-10 w-full rounded-lg text-sm hover:bg-green-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-700' }} />
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setMonth(today)}>Ir a hoy</Button>
          <Button type="button" variant="ghost" size="sm" disabled={!value} onClick={() => { onChange(undefined); setOpen(false) }}>Limpiar</Button>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">Fines de semana y festivos no disponibles. Los festivos aparecen subrayados.</p>
        {monthHolidays.length > 0 && <ul className="mt-2 space-y-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{monthHolidays.map(h => <li key={h.date}>{h.date.slice(8, 10)}: {h.name}</li>)}</ul>}
      </PopoverContent>
    </Popover>
    {hint && <p id={`${id}-hint`} className="text-xs leading-relaxed text-slate-500">{hint}</p>}
  </div>
}
