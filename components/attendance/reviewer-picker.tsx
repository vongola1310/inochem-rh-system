'use client'

import { useId, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { NOT_APPLICABLE_LABEL, REVIEWER_NOT_APPLICABLE } from '@/lib/attendance/review-policy'

type Reviewer = { id: string; name: string; employeeNumber: string }
const searchable = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function ReviewerPicker({ value, onChange, employees, employeeName }: {
  value: string; onChange: (value: string) => void; employees: Reviewer[]; employeeName: string
}) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState('')
  const labelId = useId(), listId = useId()
  const selected = employees.find(employee => employee.id === value)
  const changeOpen = (next: boolean) => { setOpen(next); if (!next) setSearch('') }
  function choose(id: string) { onChange(id); changeOpen(false) }
  return <div className="min-w-0 space-y-1">
    <p id={labelId} className="text-xs text-slate-500">Responsable del dictamen<span className="sr-only"> de {employeeName}</span></p>
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-labelledby={labelId} className="h-auto min-h-11 w-full min-w-0 justify-between gap-2 whitespace-normal bg-white px-3 text-left text-sm font-normal">
        <span className="min-w-0 break-words">{value === REVIEWER_NOT_APPLICABLE ? NOT_APPLICABLE_LABEL : selected ? `${selected.name} · ${selected.employeeNumber}` : 'Buscar y seleccionar responsable…'}</span><ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </Button></PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[260px] max-w-[calc(100vw-2rem)] p-0" onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }}>
        <Command defaultValue={value} filter={(value, query, keywords) => searchable([value, ...(keywords || [])].join(' ')).includes(searchable(query).trim()) ? 1 : 0}>
          <CommandInput aria-label={`Buscar responsable de ${employeeName}`} placeholder="Escribe nombre o número…" value={search} onValueChange={setSearch} />
          <CommandList id={listId} className="max-h-64">
            <CommandEmpty>No se encontraron responsables.</CommandEmpty>
            <CommandItem value={REVIEWER_NOT_APPLICABLE} keywords={['N/A', 'No aplica', 'Sin dictamen']} onSelect={() => choose(REVIEWER_NOT_APPLICABLE)} className="cursor-pointer gap-2 border-b border-slate-100 py-3 aria-selected:bg-[#edf4e9]">
              <Check className={`h-4 w-4 shrink-0 ${value === REVIEWER_NOT_APPLICABLE ? 'text-[#3e712c]' : 'opacity-0'}`} />
              <span><span className="block font-medium">{NOT_APPLICABLE_LABEL}</span><span className="block text-xs text-slate-500">Conservar checadas, sin proceso de incidencias.</span></span>
            </CommandItem>
            {employees.map(employee => <CommandItem key={employee.id} value={employee.id} keywords={[employee.name, employee.employeeNumber]} onSelect={() => choose(employee.id)} className="cursor-pointer gap-2 py-3 aria-selected:bg-[#edf4e9]">
              <Check className={`h-4 w-4 shrink-0 ${value === employee.id ? 'text-[#3e712c]' : 'opacity-0'}`} />
              <span className="min-w-0"><span className="block break-words">{employee.name}</span><span className="block text-xs text-slate-500">#{employee.employeeNumber}</span></span>
            </CommandItem>)}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    {value === REVIEWER_NOT_APPLICABLE && <p className="text-xs leading-relaxed text-slate-500">Conserva sus checadas. No requiere justificación ni acumula retardos o faltas en este periodo.</p>}
  </div>
}
