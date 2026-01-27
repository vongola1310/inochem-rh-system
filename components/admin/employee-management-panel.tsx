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
import { Pencil, Trash2, Save, Calculator, Shield } from 'lucide-react'
import { updateEmployee, deleteEmployee } from '@/app/actions/employee-management'
import { toast } from "sonner"

type EmployeeData = {
  id: string;
  name: string;
  email: string;
  employeeNumber: string;
  jobTitle: string | null;
  bossId: string | null;
  role: string; 
  balance: {
    totalDays: number;
    usedDays: number;
  } | null;
}

type BossOption = { id: string; name: string; jobTitle: string | null }

export function EmployeeManagementPanel({ employee, bosses }: { employee: EmployeeData, bosses: BossOption[] }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Información del Empleado</DialogTitle>
          </DialogHeader>
          <form action={handleUpdate} className="grid gap-6 py-4">
            <input type="hidden" name="id" value={employee.id} />
            
            {/* Sección Personal */}
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
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Puesto</Label>
                  <Input name="jobTitle" defaultValue={employee.jobTitle || ''} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Jefe</Label>
                  <div className="col-span-3">
                    <Select name="bossId" defaultValue={employee.bossId || "none"}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona un jefe" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">-- Sin Jefe --</SelectItem>
                            {bosses.map(b => (
                                b.id !== employee.id && (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                )
                            ))}
                        </SelectContent>
                    </Select>
                  </div>
                </div>
            </div>

            {/* Sección Vacaciones */}
            <div className="space-y-4">
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
                <p className="text-[10px] text-slate-500">
                    * Modifica estos valores solo si hay errores de cálculo o ajustes manuales necesarios.
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