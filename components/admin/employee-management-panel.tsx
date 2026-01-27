'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog"
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pencil, Trash2, Save, Calculator, Shield, Cake, Check, ChevronsUpDown, Users } from 'lucide-react'
import { updateEmployee, deleteEmployee } from '@/app/actions/employee-management'
import { toast } from "sonner"
import { format } from 'date-fns'
import { cn } from "@/lib/utils"

// Componentes del Buscador (Combobox)
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

type EmployeeData = {
  id: string;
  name: string;
  email: string;
  employeeNumber: string;
  jobTitle: string | null;
  bossId: string | null;
  role: string; 
  birthDate: Date | null;
  balance: {
    totalDays: number;
    usedDays: number;
  } | null;
}

type BossOption = { id: string; name: string; jobTitle: string | null }

export function EmployeeManagementPanel({ employee, bosses }: { employee: EmployeeData, bosses: BossOption[] }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Estado para el buscador de jefe
  const [openCombobox, setOpenCombobox] = useState(false)
  const [selectedBossId, setSelectedBossId] = useState(employee.bossId || "none")

  // Formatear fecha para el input (YYYY-MM-DD)
  // Usamos una conversión segura para evitar errores si la fecha es nula
  const defaultBirthDate = employee.birthDate 
    ? new Date(employee.birthDate).toISOString().split('T')[0]
    : ''

  async function handleUpdate(formData: FormData) {
    setIsEditing(false)
    const res = await updateEmployee(formData)
    if (res.success) {
      toast.success(res.message)
    } else {
      toast.error(res.message)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    toast.info("Eliminando empleado...")
    await deleteEmployee(employee.id)
  }

  return (
    <div className="flex gap-3 mt-4 md:mt-0">
      
      {/* BOTÓN EDITAR */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogTrigger asChild>
          <Button variant="outline" className="border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600 shadow-sm transition-all hover:-translate-y-0.5">
            <Pencil className="w-4 h-4 mr-2"/> Editar Datos
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Información del Empleado</DialogTitle>
          </DialogHeader>
          <form action={handleUpdate} className="grid gap-6 py-4">
            <input type="hidden" name="id" value={employee.id} />
            
            {/* SECCIÓN 1: DATOS PERSONALES */}
            <div className="space-y-4">
                <h4 className="font-medium text-sm text-slate-500 border-b pb-1">Datos Personales</h4>
                
                {/* Selector de Rol */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Rol Sistema</Label>
                  <div className="col-span-3">
                    <Select name="role" defaultValue={employee.role}>
                        <SelectTrigger className="bg-slate-50 border-slate-200">
                            <div className="flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5 text-slate-500"/>
                                <SelectValue placeholder="Selecciona un rol" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="EMPLOYEE">👤 Empleado Estándar</SelectItem>
                            <SelectItem value="HR">👔 Recursos Humanos (Gestor)</SelectItem>
                            <SelectItem value="ADMIN">⚙️ Administrador (IT)</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Nombre</Label>
                  <Input name="name" defaultValue={employee.name} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">No. Emp</Label>
                  <Input name="employeeNumber" defaultValue={employee.employeeNumber} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Email</Label>
                  <Input name="email" defaultValue={employee.email} className="col-span-3" />
                </div>
                
                {/* FECHA DE NACIMIENTO */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Cumpleaños</Label>
                  <div className="col-span-3 relative">
                     <Cake className="w-4 h-4 absolute left-3 top-2.5 text-pink-400 pointer-events-none"/>
                     <Input 
                        type="date" 
                        name="birthDate" 
                        defaultValue={defaultBirthDate} 
                        className="pl-9" 
                     />
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Puesto</Label>
                  <Input name="jobTitle" defaultValue={employee.jobTitle || ''} className="col-span-3" />
                </div>

                {/* JEFE CON BUSCADOR (COMBOBOX) */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Jefe</Label>
                  <div className="col-span-3">
                    {/* Input oculto para enviar el valor real */}
                    <input type="hidden" name="bossId" value={selectedBossId} />
                    
                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                        <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={openCombobox}
                            className="w-full justify-between bg-white font-normal border-slate-200"
                        >
                            <span className="flex items-center gap-2 truncate">
                                <Users className="w-3.5 h-3.5 text-slate-400"/>
                                {selectedBossId && selectedBossId !== "none"
                                    ? bosses.find((boss) => boss.id === selectedBossId)?.name
                                    : <span className="text-slate-500">-- Sin Jefe (Director) --</span>}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0 shadow-lg" align="start">
                        <Command>
                            <CommandInput placeholder="Buscar jefe por nombre..." />
                            <CommandList>
                            <CommandEmpty>No encontrado.</CommandEmpty>
                            <CommandGroup className="max-h-60 overflow-y-auto">
                                <CommandItem
                                    value="sin jefe none"
                                    onSelect={() => {
                                        setSelectedBossId("none")
                                        setOpenCombobox(false)
                                    }}
                                    className="cursor-pointer hover:bg-slate-100 !opacity-100 !pointer-events-auto"
                                >
                                <Check className={cn("mr-2 h-4 w-4 text-[#73C056]", selectedBossId === "none" ? "opacity-100" : "opacity-0")} />
                                -- Sin Jefe (Director) --
                                </CommandItem>
                                {bosses.map((boss) => (
                                // Evitar seleccionarse a sí mismo
                                boss.id !== employee.id && (
                                    <CommandItem
                                    key={boss.id}
                                    value={boss.name}
                                    onSelect={() => {
                                        setSelectedBossId(boss.id)
                                        setOpenCombobox(false)
                                    }}
                                    className="cursor-pointer hover:bg-blue-50 !opacity-100 !pointer-events-auto"
                                    >
                                    <Check className={cn("mr-2 h-4 w-4 text-[#73C056]", selectedBossId === boss.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{boss.name}</span>
                                        <span className="text-[10px] text-slate-500">{boss.jobTitle}</span>
                                    </div>
                                    </CommandItem>
                                )
                                ))}
                            </CommandGroup>
                            </CommandList>
                        </Command>
                        </PopoverContent>
                    </Popover>
                  </div>
                </div>
            </div>

            {/* SECCIÓN 2: VACACIONES (MANUAL) */}
            <div className="space-y-4 pt-2">
                <h4 className="font-medium text-sm text-slate-500 border-b pb-1 flex items-center gap-2">
                    <Calculator className="w-4 h-4"/> Ajuste de Vacaciones
                </h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Días Totales (Anuales)</Label>
                        <Input 
                            type="number" 
                            name="totalDays" 
                            defaultValue={employee.balance?.totalDays || 0} 
                            className="bg-blue-50 border-blue-200 text-blue-700 font-semibold"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Días Ya Disfrutados</Label>
                        <Input 
                            type="number" 
                            name="usedDays" 
                            defaultValue={employee.balance?.usedDays || 0} 
                            className="bg-slate-50"
                        />
                    </div>
                </div>
                <p className="text-[10px] text-slate-400 italic">
                    * Modifica estos valores solo para correcciones manuales.
                </p>
            </div>

            <DialogFooter>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
                 <Save className="w-4 h-4 mr-2"/> Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* BOTÓN ELIMINAR */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 shadow-none transition-all hover:-translate-y-0.5">
            <Trash2 className="w-4 h-4 mr-2"/> Baja
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente a <strong>{employee.name}</strong> del sistema.
              <br/><br/>
              ⚠️ Se borrará su historial de vacaciones, saldo y notificaciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
               Confirmar Baja Definitiva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}