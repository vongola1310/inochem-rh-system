'use client'

import { useState, useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DownloadExcel } from '@/components/admin/download-excel'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useRouter } from 'next/navigation'
import { Filter, Calendar, Search, RefreshCw, X } from 'lucide-react'
import { Badge } from "@/components/ui/badge"

export function BalancesTable({ data, initialStart, initialEnd }: { 
    data: any[], 
    initialStart: string, 
    initialEnd: string,
    initialJob?: string 
}) {
  const router = useRouter()
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState(initialStart)
  const [endDate, setEndDate] = useState(initialEnd)
  const [isUpdating, setIsUpdating] = useState(false)

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const filteredData = useMemo(() => {
    if (!searchTerm) return data
    const lowerTerm = searchTerm.toLowerCase()
    return data.filter(item => 
      String(item["Nombre Completo"]).toLowerCase().includes(lowerTerm) ||
      String(item["Puesto"]).toLowerCase().includes(lowerTerm) ||
      String(item["No. Empleado"]).toLowerCase().includes(lowerTerm)
    )
  }, [data, searchTerm])

  const toggleAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set())
    } else {
      const allIds = new Set(filteredData.map(item => item.id))
      setSelectedIds(allIds)
    }
  }

  const applyDateFilter = () => {
    setIsUpdating(true)
    const params = new URLSearchParams()
    if (startDate) params.set('start', startDate)
    if (endDate) params.set('end', endDate)
    router.push(`/admin/reports?${params.toString()}`)
    setTimeout(() => setIsUpdating(false), 1000)
  }

  const dataToExport = useMemo(() => {
    const list = selectedIds.size > 0 
        ? filteredData.filter(item => selectedIds.has(item.id))
        : filteredData

    // Limpiamos campos internos que no queremos en el Excel (id, _usedInPeriod)
    return list.map(({ id, _usedInPeriod, ...rest }) => rest)
  }, [filteredData, selectedIds])

  return (
    <div className="space-y-6">
      
      {/* SECCIÓN 1: CONFIGURACIÓN DE CÁLCULO (FECHAS) */}
      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex items-center gap-2 text-blue-800 mb-1 md:mb-0 md:w-1/3">
                <div className="bg-blue-100 p-2 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600"/>
                </div>
                <div>
                    <p className="text-sm font-bold">Periodo de Cálculo</p>
                    <p className="text-[10px] text-slate-500 leading-tight">Define el rango de fechas para sumar las "Vacaciones Tomadas".</p>
                </div>
            </div>
            
            <div className="w-full md:w-1/4">
                <Label className="text-xs text-slate-500 font-semibold ml-1">Fecha Inicio</Label>
                <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="bg-white h-9 border-blue-200 focus:border-blue-400"
                />
            </div>
            <div className="w-full md:w-1/4">
                <Label className="text-xs text-slate-500 font-semibold ml-1">Fecha Fin</Label>
                <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    className="bg-white h-9 border-blue-200 focus:border-blue-400"
                />
            </div>
            <div className="pb-0.5">
                <Button 
                    onClick={applyDateFilter} 
                    size="sm" 
                    className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm transition-all active:scale-95"
                    disabled={isUpdating}
                >
                    {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
                    Recalcular
                </Button>
            </div>
        </div>
      </div>

      {/* SECCIÓN 2: BÚSQUEDA RÁPIDA Y EXPORTACIÓN */}
      <div className="flex flex-col md:flex-row gap-4 items-end justify-between pt-2">
        <div className="w-full md:w-1/3 relative">
            <Label className="text-xs text-slate-500 mb-1.5 block font-medium ml-1">Buscar empleado o puesto</Label>
            <div className="relative group">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-[#73C056] transition-colors"/>
                <Input 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    placeholder="Ej: Juan, Gerente, 1045..." 
                    className="pl-9 bg-white border-slate-200 focus:border-[#73C056] focus:ring-1 focus:ring-[#73C056]"
                />
                {searchTerm && (
                    <button 
                        onClick={() => setSearchTerm("")}
                        className="absolute right-2 top-2.5 text-slate-300 hover:text-slate-500 transition-colors"
                    >
                        <X className="h-4 w-4"/>
                    </button>
                )}
            </div>
        </div>

        <div className="flex flex-col items-end gap-2 w-full md:w-auto">
            <DownloadExcel 
                data={dataToExport} 
                fileName={selectedIds.size > 0 ? "Reporte_Saldos_Seleccion" : "Reporte_Saldos_Global"} 
            />
            <span className="text-[10px] text-slate-400 font-medium px-1">
                {selectedIds.size > 0 
                    ? `${selectedIds.size} de ${filteredData.length} seleccionados` 
                    : `Mostrando ${filteredData.length} empleados`
                }
            </span>
        </div>
      </div>

      {/* TABLA DE RESULTADOS */}
      <div className="border rounded-lg overflow-hidden bg-white shadow-sm ring-1 ring-slate-100">
        <div className="max-h-[600px] overflow-auto">
            <Table>
            <TableHeader className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 shadow-sm">
                <TableRow>
                <TableHead className="w-[50px] text-center">
                    <input 
                        type="checkbox" 
                        className="cursor-pointer h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
                        checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
                        onChange={toggleAll}
                    />
                </TableHead>
                <TableHead className="font-semibold text-slate-700">Empleado</TableHead>
                <TableHead className="font-semibold text-slate-700">Puesto</TableHead>
                <TableHead className="font-semibold text-slate-700">Vigencia</TableHead>
                <TableHead className="text-center font-semibold text-blue-700 bg-blue-50/50">Tomadas</TableHead>
                <TableHead className="text-center font-bold text-slate-700">Disponibles</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredData.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center h-40 text-slate-400 italic">No se encontraron empleados con esa búsqueda.</TableCell></TableRow>
                ) : (
                    filteredData.map((row) => {
                        // CORRECCIÓN CRÍTICA: BUSCAR LA COLUMNA POR NOMBRE
                        // En lugar de row[8], buscamos la llave que empieza con "Vacaciones Tomadas"
                        const takenKey = Object.keys(row).find(k => k.startsWith('Vacaciones Tomadas')) || 'Vacaciones Tomadas'
                        const takenValue = row[takenKey]

                        return (
                        <TableRow 
                            key={row.id} 
                            className={`transition-colors border-b border-slate-50 last:border-0 ${selectedIds.has(row.id) ? "bg-blue-50/40 hover:bg-blue-50/60" : "hover:bg-slate-50"}`}
                        >
                            <TableCell className="text-center">
                                <input 
                                    type="checkbox" 
                                    className="cursor-pointer h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
                                    checked={selectedIds.has(row.id)}
                                    onChange={() => toggleSelection(row.id)}
                                />
                            </TableCell>
                            <TableCell className="font-medium">
                                <div className="flex flex-col">
                                    <span className="text-slate-900">{row["Nombre Completo"]}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">ID: {row["No. Empleado"]}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">{row["Puesto"]}</TableCell>
                            <TableCell className="text-xs text-slate-500">{row["Vigencia Actual"]}</TableCell>
                            
                            {/* Columna Dinámica (Ya no falla si cambia el orden) */}
                            <TableCell className="text-center font-medium bg-blue-50/30 text-blue-700 text-sm border-x border-blue-50">
                                {String(takenValue)}
                            </TableCell>
                            
                            <TableCell className="text-center">
                                <Badge variant="outline" className={row["Saldo Disponible"] < 0 ? "text-red-600 bg-red-50 border-red-200" : "text-slate-700 bg-slate-50"}>
                                    {row["Saldo Disponible"]}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    )})
                )}
            </TableBody>
            </Table>
        </div>
      </div>
    </div>
  )
}