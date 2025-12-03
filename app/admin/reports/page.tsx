import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Users, CalendarRange, FileText, Download, Filter, BarChart3 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DownloadExcel } from '@/components/admin/download-excel'
import { getBalanceReport, getMovementReport } from '@/app/actions/report-data'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BalancesTable } from '@/components/admin/reports/balances-table'

export default async function ReportsPage({ 
  searchParams 
}: { 
  searchParams: { start?: string, end?: string, job?: string } 
}) {
  const session = await auth()
  if ((session?.user as any)?.role !== 'HR') redirect('/')

  // En Next.js 14 searchParams es un objeto directo, no una promesa
  const params = searchParams

  const today = new Date().toISOString().split('T')[0]
  const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  
  const startDate = params?.start || startOfYear
  const endDate = params?.end || today
  const jobFilter = params?.job || ''

  const balanceData = await getBalanceReport(jobFilter, startDate, endDate)
  const movementsData = await getMovementReport(startDate, endDate)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Botón de Regreso */}
        <div className="mb-6">
          <Link href="/">
            <Button 
              variant="ghost" 
              className="text-slate-600 hover:text-[#73C056] hover:bg-[#73C056]/5 transition-all -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Panel
            </Button>
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-14 w-14 rounded-xl bg-[#73C056]/10 flex items-center justify-center shrink-0">
              <BarChart3 className="h-7 w-7 text-[#73C056]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Centro de Reportes</h1>
              <p className="text-slate-600 mt-1">Auditoría y control de vacaciones</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-[#73C056] shadow-sm">
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Total Empleados</p>
                    <p className="text-3xl font-bold text-slate-900">{balanceData.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-[#73C056]" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Movimientos</p>
                    <p className="text-3xl font-bold text-slate-900">{movementsData.length}</p>
                  </div>
                  <CalendarRange className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 shadow-sm">
              <CardContent className="pt-6 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Periodo Activo</p>
                    <p className="text-lg font-bold text-slate-900 truncate">
                      {new Date(startDate + 'T12:00:00Z').toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })} - {new Date(endDate + 'T12:00:00Z').toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <Filter className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="balances" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6 bg-white border border-slate-200 p-1 shadow-sm h-auto">
            <TabsTrigger 
              value="balances" 
              className="flex items-center gap-2 data-[state=active]:bg-[#73C056] data-[state=active]:text-white transition-all py-2.5"
            >
              <Users className="h-4 w-4"/>
              <span className="hidden sm:inline">Saldos y Vigencias</span>
              <span className="sm:hidden">Saldos</span>
            </TabsTrigger>
            <TabsTrigger 
              value="movements" 
              className="flex items-center gap-2 data-[state=active]:bg-[#73C056] data-[state=active]:text-white transition-all py-2.5"
            >
              <CalendarRange className="h-4 w-4"/>
              <span className="hidden sm:inline">Bitácora</span>
              <span className="sm:hidden">Bitácora</span>
            </TabsTrigger>
          </TabsList>

          {/* PESTAÑA 1: SALDOS */}
          <TabsContent value="balances">
            <Card className="shadow-lg border-slate-200">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-slate-900 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-[#73C056]" />
                      Reporte de Estado de Fuerza
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Selecciona empleados para exportar. El cálculo de &quot;Tomadas&quot; obedece al rango de fechas.
                    </CardDescription>
                  </div>
                  <Badge className="bg-[#73C056]/10 text-[#73C056] border-[#73C056]/30 w-fit">
                    {balanceData.length} registros
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <BalancesTable 
                  data={balanceData} 
                  initialStart={startDate}
                  initialEnd={endDate}
                  initialJob={jobFilter}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* PESTAÑA 2: MOVIMIENTOS */}
          <TabsContent value="movements">
            <Card className="shadow-lg border-slate-200">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-slate-900 flex items-center gap-2">
                      <CalendarRange className="h-5 w-5 text-[#73C056]" />
                      Bitácora de Solicitudes
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Lista detallada de todas las solicitudes en el periodo.
                    </CardDescription>
                  </div>
                  <Badge className="bg-blue-100 text-blue-700 border-blue-300 w-fit">
                    {movementsData.length} movimientos
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Filtros */}
                <div className="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-200 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Filter className="h-4 w-4 text-slate-600" />
                    <h3 className="text-sm font-semibold text-slate-900">Filtros de Búsqueda</h3>
                  </div>
                  
                  <form className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="w-full sm:flex-1">
                      <Label className="text-slate-700 font-medium text-sm">Fecha Inicio</Label>
                      <Input 
                        type="date" 
                        name="start" 
                        defaultValue={startDate} 
                        className="mt-1.5 bg-white border-slate-300 focus:border-[#73C056]"
                      />
                    </div>
                    <div className="w-full sm:flex-1">
                      <Label className="text-slate-700 font-medium text-sm">Fecha Fin</Label>
                      <Input 
                        type="date" 
                        name="end" 
                        defaultValue={endDate} 
                        className="mt-1.5 bg-white border-slate-300 focus:border-[#73C056]"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full sm:w-auto bg-[#73C056] hover:bg-[#62a847] text-white"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Actualizar
                    </Button>
                    <DownloadExcel 
                      data={movementsData} 
                      fileName={`Movimientos_${startDate}_al_${endDate}`} 
                    />
                  </form>
                </div>

                {/* Vista Previa */}
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="font-semibold text-slate-700">Folio</TableHead>
                          <TableHead className="font-semibold text-slate-700">Empleado</TableHead>
                          <TableHead className="font-semibold text-slate-700">Tipo</TableHead>
                          <TableHead className="font-semibold text-slate-700">Fecha Inicio</TableHead>
                          <TableHead className="font-semibold text-slate-700">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movementsData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-32 text-center">
                              <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                <CalendarRange className="h-10 w-10 text-slate-300" />
                                <p className="font-medium">Sin movimientos en este periodo</p>
                                <p className="text-sm text-slate-400">Ajusta los filtros de fecha</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          movementsData.slice(0, 8).map((row, i) => (
                            <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                              <TableCell className="font-mono text-xs text-slate-600">
                                {row["Folio"]}
                              </TableCell>
                              <TableCell className="font-medium text-slate-900">
                                {row["Empleado"]}
                              </TableCell>
                              <TableCell className="text-slate-700 text-sm">
                                {row["Tipo Solicitud"]}
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {row["Fecha Inicio"]}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  className={
                                    row["Estado Final"] === 'APPROVED' 
                                      ? 'bg-[#73C056]/10 text-[#73C056] border-[#73C056]/30 hover:bg-[#73C056]/20' 
                                      : row["Estado Final"] === 'REJECTED' 
                                      ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                  }
                                >
                                  {row["Estado Final"]}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {movementsData.length > 8 && (
                    <div className="bg-slate-50 p-3 text-center border-t border-slate-200">
                      <p className="text-sm text-slate-600">
                        Mostrando <span className="font-semibold">8</span> de <span className="font-semibold">{movementsData.length}</span> registros
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        <Download className="h-3 w-3 inline mr-1" />
                        Descarga el Excel para ver todos los datos
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}