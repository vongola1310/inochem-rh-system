'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Calendar, Briefcase, User, Search, Filter, X, TrendingUp, CheckCircle2 } from 'lucide-react'
import { differenceInMonths } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

// Tipo de datos que recibimos
type EmployeeData = {
  id: string
  name: string
  employeeNumber: string
  jobTitle: string | null
  entryDate: Date
  role: string
  boss: { name: string; jobTitle: string | null } | null
  balance: { totalDays: number; usedDays: number; pendingDays: number } | null
}

export function EmployeesTable({ initialData }: { initialData: any[] }) {
  // Conversión segura de fechas
  const data = useMemo(() => {
    return initialData.map(e => ({
      ...e,
      entryDate: new Date(e.entryDate)
    })) as EmployeeData[]
  }, [initialData])

  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")

  // Filtramos los datos en tiempo real
  const filteredEmployees = useMemo(() => {
    return data.filter(emp => {
      const searchLower = searchTerm.toLowerCase()
      
      // Filtro por Texto
      const matchesSearch = 
        emp.name.toLowerCase().includes(searchLower) ||
        emp.employeeNumber.toLowerCase().includes(searchLower) ||
        (emp.jobTitle?.toLowerCase().includes(searchLower) ?? false)

      // Filtro por Rol
      let matchesRole = true
      if (roleFilter !== "ALL") {
        if (roleFilter === "BOSS") {
          const job = emp.jobTitle?.toLowerCase() || ""
          matchesRole = job.includes("gerente") || job.includes("coordinador") || 
                       job.includes("jefe") || job.includes("director")
        } else {
          matchesRole = emp.role === roleFilter
        }
      }

      return matchesSearch && matchesRole
    })
  }, [data, searchTerm, roleFilter])

  // Calcular antigüedad
  const calculateSeniority = (entryDate: Date) => {
    const months = differenceInMonths(new Date(), entryDate)
    const years = Math.floor(months / 12)
    const remainingMonths = months % 12
    
    if (years === 0) return `${remainingMonths}m`
    if (remainingMonths === 0) return `${years}a`
    return `${years}a ${remainingMonths}m`
  }

  return (
    <div className="flex flex-col h-[calc(100vh-300px)] min-h-[600px]">
      
      {/* HEADER CON ESTADÍSTICAS */}
      <div className="bg-white rounded-t-xl border-x border-t border-slate-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-[#73C056]"/> Directorio de Personal
            </h2>
            <p className="text-sm text-slate-500">Lista completa de empleados</p>
          </div>
          
          {/* Mini Stats */}
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-green-600"/>
              <div className="flex flex-col leading-none">
                <span className="text-[10px] text-green-600 font-bold uppercase">Mostrando</span>
                <span className="text-sm font-bold text-green-900">{filteredEmployees.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <TrendingUp className="h-4 w-4 text-blue-600"/>
              <div className="flex flex-col leading-none">
                <span className="text-[10px] text-blue-600 font-bold uppercase">Total</span>
                <span className="text-sm font-bold text-blue-900">{data.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA Y FILTROS */}
        <div className="flex flex-col sm:flex-row gap-3">
          
          {/* Buscador */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Buscar por nombre, puesto o número..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-9 bg-white border-slate-300 focus:border-[#73C056] focus:ring-[#73C056] h-10"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtro por Rol */}
          <div className="w-full sm:w-[220px]">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="bg-white border-slate-300 h-10">
                <div className="flex items-center gap-2 text-slate-700">
                  <Filter className="h-4 w-4" />
                  <SelectValue placeholder="Filtrar por..." />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">📋 Todos los empleados</SelectItem>
                <SelectItem value="BOSS">👔 Solo Jefes / Gerentes</SelectItem>
                <SelectItem value="HR">💼 Recursos Humanos</SelectItem>
                <SelectItem value="ADMIN">⚙️ Administradores IT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Indicador de Filtro Activo */}
        {(roleFilter !== "ALL" || searchTerm) && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-slate-600">Filtros activos:</span>
            {roleFilter !== "ALL" && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                {roleFilter === "BOSS" ? "Jefes" : roleFilter}
              </Badge>
            )}
            {searchTerm && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                Búsqueda: "{searchTerm}"
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setSearchTerm("")
                setRoleFilter("ALL")
              }}
              className="h-6 px-2 text-xs text-slate-500 hover:text-red-600"
            >
              Limpiar todo <X className="h-3 w-3 ml-1"/>
            </Button>
          </div>
        )}
      </div>

      {/* TABLA CON SCROLL INDEPENDIENTE */}
      <div className="flex-1 overflow-auto bg-white border-x border-slate-200">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50 z-10 shadow-sm">
            <TableRow className="hover:bg-slate-50">
              <TableHead className="font-bold text-slate-700 pl-6 w-[280px]">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4"/> Empleado
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-700 w-[200px]">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4"/> Puesto
                </div>
              </TableHead>
              <TableHead className="font-bold text-slate-700 w-[180px]">
                Reporta A
              </TableHead>
              <TableHead className="text-center font-bold text-slate-700 w-[120px]">
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4"/> Antigüedad
                </div>
              </TableHead>
              <TableHead className="text-center font-bold text-slate-700 w-[100px]">
                Disponibles
              </TableHead>
              <TableHead className="text-right font-bold text-slate-700 pr-6 w-[120px]">
                Acción
              </TableHead>
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-60">
                  <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                    <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                      <Search className="h-8 w-8 text-slate-300" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-600">
                        {searchTerm ? `No se encontraron resultados para "${searchTerm}"` : "No hay empleados"}
                      </p>
                      <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((emp) => {
                const total = emp.balance?.totalDays || 0
                const used = emp.balance?.usedDays || 0
                const pending = emp.balance?.pendingDays || 0
                const available = total - used - pending
                
                const initials = emp.name.split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase()
                const seniority = calculateSeniority(emp.entryDate)
                
                return (
                  <TableRow 
                    key={emp.id} 
                    className="group hover:bg-[#73C056]/5 transition-colors border-b border-slate-100"
                  >
                    {/* Empleado */}
                    <TableCell className="pl-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-slate-100">
                          <AvatarFallback className="bg-[#73C056] text-white text-xs font-bold group-hover:bg-[#5da043] transition-colors">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{emp.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500 font-mono">#{emp.employeeNumber}</span>
                            {emp.role === 'HR' && (
                              <Badge className="h-4 px-1.5 text-[9px] bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">
                                RH
                              </Badge>
                            )}
                            {emp.role === 'ADMIN' && (
                              <Badge className="h-4 px-1.5 text-[9px] bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100">
                                Admin
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Puesto */}
                    <TableCell>
                      <span className="text-sm text-slate-700 font-medium block truncate max-w-[180px]" title={emp.jobTitle || ''}>
                        {emp.jobTitle || '—'}
                      </span>
                    </TableCell>

                    {/* Reporta A */}
                    <TableCell>
                      {emp.boss ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-400"/>
                          <span className="font-medium truncate max-w-[140px]" title={emp.boss.name}>
                            {emp.boss.name}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-slate-400 font-normal border-slate-200 bg-slate-50 text-xs">
                          Dirección
                        </Badge>
                      )}
                    </TableCell>

                    {/* Antigüedad */}
                    <TableCell className="text-center">
                      <Badge 
                        variant="secondary" 
                        className="font-mono text-xs bg-slate-100 text-slate-700 hover:bg-slate-100 border border-slate-200"
                      >
                        {seniority}
                      </Badge>
                    </TableCell>

                    {/* Días Disponibles */}
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`font-bold text-base ${
                          available < 0 ? 'text-red-600' : 
                          available < 5 ? 'text-amber-600' : 
                          'text-green-600'
                        }`}>
                          {available}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">días</span>
                      </div>
                    </TableCell>

                    {/* Acción */}
                    <TableCell className="text-right pr-6">
                      <Link href={`/admin/employees/${emp.id}`}>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-3 text-slate-600 hover:text-[#73C056] hover:bg-[#73C056]/10 font-medium text-xs transition-all"
                        >
                          Ver perfil
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* FOOTER DE LA TABLA */}
      <div className="bg-slate-50 border-x border-b border-slate-200 rounded-b-xl p-3 flex justify-between items-center text-xs text-slate-600">
        <span className="font-medium">
          Mostrando <span className="text-[#73C056] font-bold">{filteredEmployees.length}</span> de {data.length} empleados
        </span>
        {roleFilter !== "ALL" && (
          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium border border-blue-200">
            Filtro: {roleFilter === "BOSS" ? "Jefes" : roleFilter}
          </span>
        )}
      </div>
    </div>
  )
}