'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { registerEmployee } from '@/app/actions/register-employee'
import { toast } from "sonner"
import { UserPlus, Mail, Briefcase, Calendar, Shield, Users, Hash, Send, Calculator, Check, ChevronsUpDown, Cake } from 'lucide-react'
import { differenceInYears } from 'date-fns'
import { cn } from "@/lib/utils"

// Usamos los componentes oficiales de Shadcn para el buscador
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type SimpleUser = { id: string; name: string; jobTitle: string | null }

// Función auxiliar para sugerir días de vacaciones (Ley + Bono)
function suggestVacationDays(entryDateStr: string): number {
  if (!entryDateStr) return 0
  const years = differenceInYears(new Date(), new Date(entryDateStr))
  
  let statutoryDays = 0
  if (years < 1) statutoryDays = 0;
  else if (years === 1) statutoryDays = 12;
  else if (years === 2) statutoryDays = 14;
  else if (years === 3) statutoryDays = 16;
  else if (years === 4) statutoryDays = 18;
  else if (years === 5) statutoryDays = 20;
  else if (years >= 6 && years <= 10) statutoryDays = 22;
  else if (years >= 11 && years <= 15) statutoryDays = 24;
  else if (years >= 16 && years <= 20) statutoryDays = 26;
  else if (years >= 21 && years <= 25) statutoryDays = 28;
  else if (years >= 26 && years <= 30) statutoryDays = 30;
  else statutoryDays = 32;

  if (years >= 1) return statutoryDays + 5;
  return statutoryDays;
}

export function RegisterEmployeeForm({ possibleBosses }: { possibleBosses: SimpleUser[] }) {
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState('EMPLOYEE')
  
  // Estados para el Combobox (Buscador de Jefes)
  const [openCombobox, setOpenCombobox] = useState(false)
  const [selectedBossId, setSelectedBossId] = useState("")

  const formRef = useRef<HTMLFormElement>(null)
  
  const [entryDate, setEntryDate] = useState("")
  const [days, setDays] = useState(0)
  const [isAutoCalculated, setIsAutoCalculated] = useState(true)

  // Efecto para calcular vacaciones al cambiar fecha de ingreso
  useEffect(() => {
    if (entryDate && isAutoCalculated) {
      const suggested = suggestVacationDays(entryDate)
      setDays(suggested)
    }
  }, [entryDate, isAutoCalculated])

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    const res = await registerEmployee(formData)
    setLoading(false)

    if (res.success) {
      toast.success("Empleado Registrado", { description: res.message })
      formRef.current?.reset()
      setSelectedRole('EMPLOYEE')
      setEntryDate("")
      setDays(0)
      setIsAutoCalculated(true)
      setSelectedBossId("")
    } else {
      toast.error("Error al Registrar", { description: res.message })
    }
  }

  const yearsOfService = entryDate ? differenceInYears(new Date(), new Date(entryDate)) : 0

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="h-10 w-10 rounded-lg bg-[#73C056]/10 flex items-center justify-center">
          <UserPlus className="h-5 w-5 text-[#73C056]" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-slate-900">Alta de Nuevo Empleado</h3>
          <p className="text-sm text-slate-500">Registro completo en el sistema</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Número de Empleado */}
        <div className="space-y-2">
          <Label className="text-slate-700 font-medium flex items-center gap-1.5">
            <Hash className="h-3.5 w-3.5 text-[#73C056]" /> Número de Empleado <span className="text-red-500">*</span>
          </Label>
          <Input name="employeeNumber" placeholder="Ej: 1045" required className="border-slate-300 focus:border-[#73C056]" />
        </div>

        {/* Nombre */}
        <div className="space-y-2">
          <Label className="text-slate-700 font-medium flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-[#73C056]" /> Nombre Completo <span className="text-red-500">*</span>
          </Label>
          <Input name="name" placeholder="Ej: Ana López García" required className="border-slate-300 focus:border-[#73C056]" />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label className="text-slate-700 font-medium flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-[#73C056]" /> Correo Corporativo <span className="text-red-500">*</span>
          </Label>
          <Input name="email" type="email" placeholder="ana.lopez@empresa.com" required className="border-slate-300 focus:border-[#73C056]" />
        </div>

        {/* Puesto */}
        <div className="space-y-2">
          <Label className="text-slate-700 font-medium flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 text-[#73C056]" /> Puesto <span className="text-red-500">*</span>
          </Label>
          <Input name="jobTitle" placeholder="Ej: Analista de Calidad" required className="border-slate-300 focus:border-[#73C056]" />
        </div>

        {/* Fecha de Ingreso */}
        <div className="space-y-2">
          <Label className="text-slate-700 font-medium flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-[#73C056]" /> Fecha de Ingreso <span className="text-red-500">*</span>
          </Label>
          <Input 
            name="entryDate" 
            type="date" 
            required 
            value={entryDate}
            onChange={(e) => { setEntryDate(e.target.value); setIsAutoCalculated(true) }}
            className="border-slate-300 focus:border-[#73C056]"
          />
          {entryDate && (
            <p className="text-xs text-slate-500">📊 Antigüedad: <span className="font-semibold text-[#73C056]">{yearsOfService} años</span></p>
          )}
        </div>

        {/* Fecha de Nacimiento (NUEVO CAMPO) */}
        <div className="space-y-2">
          <Label className="text-slate-700 font-medium flex items-center gap-1.5">
            <Cake className="h-3.5 w-3.5 text-pink-500" /> Fecha de Nacimiento
          </Label>
          <Input 
            name="birthDate" 
            type="date" 
            className="border-slate-300 focus:border-[#73C056]"
          />
          <p className="text-xs text-slate-500">Para automatizar permiso de cumpleaños.</p>
        </div>

        {/* Saldo de Vacaciones */}
        <div className="space-y-2">
          <Label className="text-slate-700 font-medium flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5 text-blue-600" /> Saldo de Vacaciones <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Input 
              name="manualBalance" 
              type="number" 
              required 
              min="0"
              value={days}
              onChange={(e) => { setDays(Number(e.target.value)); setIsAutoCalculated(false) }}
              className={`font-semibold border-2 ${isAutoCalculated ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-amber-50 border-amber-300 text-amber-700'}`}
            />
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium ${isAutoCalculated ? 'text-blue-500' : 'text-amber-500'}`}>días</span>
          </div>
        </div>

        {/* Rol */}
        <div className="space-y-2">
          <Label className="text-slate-700 font-medium flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-[#73C056]" /> Rol en el Sistema <span className="text-red-500">*</span>
          </Label>
          <Select name="role" value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="border-slate-300 focus:border-[#73C056]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EMPLOYEE">👤 Empleado Estándar</SelectItem>
              <SelectItem value="ADMIN">⚙️ Administrador (IT)</SelectItem>
              <SelectItem value="HR">👔 Recursos Humanos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ASIGNACIÓN DE JEFE - COMBOBOX CON BUSCADOR */}
        <div className="space-y-2 md:col-span-2">
          <Label className="text-slate-700 font-medium flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-[#73C056]" /> Jefe Inmediato
          </Label>
          
          <input type="hidden" name="bossId" value={selectedBossId} />

          <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
            <PopoverTrigger asChild>
              <Button
                type="button" 
                variant="outline"
                role="combobox"
                aria-expanded={openCombobox}
                className="w-full justify-between border-slate-300 text-slate-700 font-normal hover:border-[#73C056] hover:bg-white active:scale-[0.99] transition-all"
              >
                {selectedBossId
                  ? selectedBossId === "none"
                    ? "-- Sin Jefe (Director) --"
                    : possibleBosses.find((boss) => boss.id === selectedBossId)?.name
                  : "Buscar empleado por nombre..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0 shadow-xl border-slate-200" align="start">
              <Command>
                <CommandInput placeholder="Escribe para buscar..." />
                <CommandList>
                  <CommandEmpty>No se encontró el empleado.</CommandEmpty>
                  <CommandGroup heading="Opciones">
                    
                    <CommandItem
                      value="sin jefe director none"
                      onSelect={() => {
                        setSelectedBossId("none")
                        setOpenCombobox(false)
                      }}
                      className="cursor-pointer hover:bg-slate-100 aria-selected:bg-slate-100 !opacity-100 !pointer-events-auto py-2.5 px-3 mb-1"
                    >
                      <Check className={cn("mr-2 h-4 w-4 text-[#73C056]", selectedBossId === "none" ? "opacity-100" : "opacity-0")} />
                      <span className="text-slate-500 italic">-- Sin Jefe (Director) --</span>
                    </CommandItem>
                    
                    {possibleBosses.map((boss) => (
                      <CommandItem
                        key={boss.id}
                        value={boss.name}
                        onSelect={() => {
                          setSelectedBossId(boss.id)
                          setOpenCombobox(false)
                        }}
                        className="cursor-pointer hover:bg-blue-50 aria-selected:bg-blue-50 !opacity-100 !pointer-events-auto py-2.5 px-3 mb-0.5 rounded-sm transition-colors"
                      >
                        <Check className={cn("mr-2 h-4 w-4 text-[#73C056]", selectedBossId === boss.id ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800">{boss.name}</span>
                          <span className="text-xs text-slate-500">{boss.jobTitle || 'Sin puesto'}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          
          <p className="text-xs text-slate-500">
            Escribe el nombre para buscar en la lista completa de empleados.
          </p>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-3">
          <div className="text-blue-600 mt-0.5">ℹ️</div>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Configuración automática:</p>
            <ul className="text-xs space-y-1 text-blue-700">
              <li>• Contraseña temporal = Número de Empleado</li>
              <li>• El usuario podrá cambiarla al iniciar sesión</li>
            </ul>
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full bg-[#73C056] hover:bg-[#62a847] text-white font-semibold py-6 shadow-md" disabled={loading}>
        {loading ? (
          <>Enviando...</>
        ) : (
          <><Send className="mr-2 h-4 w-4" /> Dar de Alta Empleado</>
        )}
      </Button>
    </form>
  )
}