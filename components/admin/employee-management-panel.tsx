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
import { Pencil, Trash2, Save } from 'lucide-react'
import { updateEmployee, deleteEmployee } from '@/app/actions/employee-management'
import { toast } from "sonner"

type EmployeeData = {
  id: string;
  name: string;
  email: string;
  employeeNumber: string;
  jobTitle: string | null;
  bossId: string | null;
}

type BossOption = { id: string; name: string; jobTitle: string | null }

export function EmployeeManagementPanel({ employee, bosses }: { employee: EmployeeData, bosses: BossOption[] }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Acción de Actualizar
  async function handleUpdate(formData: FormData) {
    setIsEditing(false)
    const res = await updateEmployee(formData)
    if (res.success) {
      toast.success(res.message)
    } else {
      toast.error(res.message)
    }
  }

  // Acción de Eliminar
  async function handleDelete() {
    setIsDeleting(true)
    toast.info("Eliminando empleado...")
    // La redirección ocurre en el servidor, así que no necesitamos hacer mucho más aquí
    await deleteEmployee(employee.id)
  }

  return (
    <div className="flex gap-3 mt-4">
      
      {/* BOTÓN EDITAR (ABRE MODAL) */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogTrigger asChild>
          <Button variant="outline" className="border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600">
            <Pencil className="w-4 h-4 mr-2"/> Editar Datos
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Empleado</DialogTitle>
          </DialogHeader>
          <form action={handleUpdate} className="grid gap-4 py-4">
            <input type="hidden" name="id" value={employee.id} />
            
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
                            // Evitar que se seleccione a sí mismo como jefe
                            b.id !== employee.id && (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            )
                        ))}
                    </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                 <Save className="w-4 h-4 mr-2"/> Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* BOTÓN ELIMINAR (CON ALERTA DE SEGURIDAD) */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 shadow-none">
            <Trash2 className="w-4 h-4 mr-2"/> Dar de Baja
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente a <strong>{employee.name}</strong> del sistema, junto con su historial de vacaciones y saldo. <br/><br/>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
               Confirmar Baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}