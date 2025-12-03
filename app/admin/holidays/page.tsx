import { PrismaClient } from '@prisma/client'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, CalendarPlus, CalendarDays, ArrowLeft, Calendar, Info } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const prisma = new PrismaClient()

async function addHoliday(formData: FormData) {
  'use server'
  const dateStr = formData.get('date') as string
  const name = formData.get('name') as string
  const date = new Date(dateStr + 'T12:00:00Z') 
  await prisma.holiday.create({ data: { date, name } })
  revalidatePath('/admin/holidays')
}

async function deleteHoliday(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  await prisma.holiday.delete({ where: { id } })
  revalidatePath('/admin/holidays')
}

export default async function HolidaysPage() {
  const session = await auth()
  if ((session?.user as any)?.role !== 'HR') redirect('/')

  const holidays = await prisma.holiday.findMany({ orderBy: { date: 'asc' } })

  // Separar festivos por año
  const holidaysByYear = holidays.reduce((acc, holiday) => {
    const year = new Date(holiday.date).getFullYear()
    if (!acc[year]) acc[year] = []
    acc[year].push(holiday)
    return acc
  }, {} as Record<number, typeof holidays>)

  const years = Object.keys(holidaysByYear).sort((a, b) => Number(b) - Number(a))

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-slate-100 to-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Botón de Regreso */}
        <div className="mb-6">
          <Link href="/">
            <Button 
              variant="ghost" 
              className="text-slate-600 hover:text-[#73C056] hover:bg-[#73C056]/5 transition-all -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Panel RH
            </Button>
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-[#73C056]/10 flex items-center justify-center shrink-0">
                <CalendarDays className="h-7 w-7 text-[#73C056]" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Calendario Oficial</h1>
                <p className="text-slate-600 mt-1">Gestión de días inhábiles y festivos</p>
              </div>
            </div>
            
            <div className="bg-white px-5 py-3 rounded-xl border-2 border-[#73C056]/20 shadow-sm">
              <p className="text-xs text-slate-500 mb-1">Total Registrados</p>
              <p className="text-3xl font-bold text-[#73C056]">{holidays.length}</p>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          
          {/* FORMULARIO */}
          <div className="lg:col-span-1">
            <Card className="border-slate-200 shadow-lg sticky top-6">
              <CardHeader className="bg-linear-to-r from-[#73C056] to-[#62a847] text-white">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <CalendarPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-black">Agregar Festivo</CardTitle>
                    <CardDescription className="text-black/90 text-sm">
                      Nuevo día inhábil
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <form action={addHoliday} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-slate-700 font-medium">
                      Fecha del Festivo
                    </Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input 
                        id="date"
                        type="date" 
                        name="date" 
                        required 
                        className="pl-10 border-slate-300 focus:border-[#73C056] focus:ring-[#73C056]"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-700 font-medium">
                      Nombre de la Festividad
                    </Label>
                    <Input 
                      id="name"
                      name="name" 
                      placeholder="Ej: Día de la Independencia" 
                      required 
                      className="border-slate-300 focus:border-[#73C056] focus:ring-[#73C056]"
                    />
                  </div>
                  
                  <Button className="w-full bg-[#73C056] hover:bg-[#62a847] text-white font-semibold h-11 shadow-md hover:shadow-lg transition-all">
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Agregar al Calendario
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Info Card */}
            <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-2">💡 Nota Importante</p>
                  <p className="text-blue-800 leading-relaxed">
                    El sistema descuenta automáticamente <strong>sábados y domingos</strong>. Por favor, registre únicamente los días festivos que correspondan a días hábiles (lunes a viernes).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* LISTA DE FESTIVOS */}
          <div className="lg:col-span-2 space-y-6">
            {holidays.length === 0 ? (
              <Card className="border-slate-200 shadow-lg">
                <CardContent className="py-20">
                  <div className="flex flex-col items-center justify-center text-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                      <CalendarDays className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium text-lg">No hay festivos registrados</p>
                    <p className="text-sm text-slate-500">Agrega el primer día festivo usando el formulario</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              years.map((year) => (
                <Card key={year} className="border-slate-200 shadow-lg overflow-hidden">
                  <CardHeader className="bg-linear-to-r from-slate-50 to-white border-b border-slate-200 pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-slate-900 flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-[#73C056]" />
                        Año {year}
                      </CardTitle>
                      <Badge className="bg-[#73C056]/10 text-[#73C056] border-[#73C056]/30 hover:bg-[#73C056]/20">
                        {holidaysByYear[Number(year)].length} {holidaysByYear[Number(year)].length === 1 ? 'festivo' : 'festivos'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                            <TableHead className="font-semibold text-slate-700">Fecha</TableHead>
                            <TableHead className="font-semibold text-slate-700">Festividad</TableHead>
                            <TableHead className="text-right font-semibold text-slate-700">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {holidaysByYear[Number(year)].map((h) => (
                            <TableRow key={h.id} className="hover:bg-slate-50 transition-colors">
                              <TableCell className="font-medium text-slate-900">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-lg bg-[#73C056]/10 flex items-center justify-center shrink-0">
                                    <CalendarDays className="h-5 w-5 text-[#73C056]" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-900">
                                      {format(new Date(h.date), "d 'de' MMMM", { locale: es })}
                                    </p>
                                    <p className="text-xs text-slate-500 capitalize">
                                      {format(new Date(h.date), "EEEE", { locale: es })}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-700">{h.name}</TableCell>
                              <TableCell className="text-right">
                                <form action={deleteHoliday} className="inline">
                                  <input type="hidden" name="id" value={h.id} />
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9 w-9 p-0 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </form>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}