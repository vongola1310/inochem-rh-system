import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CalendarDays, AlertTriangle } from "lucide-react"
import { formatUTC } from "@/lib/format-date"
import type { TeamMemberVacation } from "@/lib/team-vacations"

const EXPIRY_WARNING_DAYS = 45

export function TeamBalancesTable({ members }: { members: TeamMemberVacation[] }) {
  const totals = members.reduce(
    (acc, m) => ({
      total: acc.total + m.totalDays,
      used: acc.used + m.usedDays,
      pending: acc.pending + m.pendingDays,
      available: acc.available + m.availableDays,
    }),
    { total: 0, used: 0, pending: 0, available: 0 }
  )

  return (
    <Card className="shadow-md border-slate-200 overflow-hidden">
      <CardHeader className="border-b border-slate-100 bg-white">
        <CardTitle className="text-lg flex flex-wrap justify-between items-center gap-2">
          <span className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#73C056]" />
            Días de vacaciones del equipo
          </span>
          <div className="flex flex-wrap gap-2 text-xs font-normal">
            <Badge variant="outline" className="text-slate-600">Le tocan: <b className="ml-1">{totals.total}</b></Badge>
            <Badge variant="outline" className="text-slate-500">Aprobados por jefe: <b className="ml-1">{totals.used}</b></Badge>
            <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">Pendientes de jefe: <b className="ml-1">{totals.pending}</b></Badge>
            <Badge variant="outline" className="text-[#5fa843] border-[#73C056]/30 bg-[#73C056]/10">Disponibles: <b className="ml-1">{totals.available}</b></Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
              <TableHead className="pl-6 font-bold text-slate-700">Colaborador</TableHead>
              <TableHead className="font-bold text-slate-700">Antigüedad</TableHead>
              <TableHead className="font-bold text-slate-700">Vigencia actual</TableHead>
              <TableHead className="text-center font-bold text-slate-700">Le tocan</TableHead>
              <TableHead className="text-center font-bold text-slate-700">Aprobados por jefe</TableHead>
              <TableHead className="text-center font-bold text-slate-700">Pendientes de jefe</TableHead>
              <TableHead className="text-center font-bold text-slate-700">Disponibles</TableHead>
              <TableHead className="pr-6 font-bold text-slate-700">Próximo periodo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const expiringSoon = m.availableDays > 0 && m.daysToAnniversary <= EXPIRY_WARNING_DAYS
              return (
                <TableRow key={m.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-slate-200 bg-white">
                        <AvatarFallback className="bg-[#73C056]/10 text-[#73C056] font-bold text-xs">
                          {m.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-slate-900 font-semibold">{m.name}</span>
                        <span className="text-[10px] text-slate-500 uppercase">
                          {m.jobTitle || 'Colaborador'} · #{m.employeeNumber}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                    {m.yearsWorked} {m.yearsWorked === 1 ? 'año' : 'años'}
                    <div className="text-[10px] text-slate-400">Ingreso {formatUTC(m.entryDate, "d MMM yyyy")}</div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                    {formatUTC(m.cycleStart, "d MMM yy")} — {formatUTC(m.cycleEnd, "d MMM yy")}
                    {expiringSoon && (
                      <div className="flex items-center gap-1 text-[10px] text-orange-600 font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        {m.daysToAnniversary === 0 ? 'Vence hoy' : `Vence en ${m.daysToAnniversary} ${m.daysToAnniversary === 1 ? 'día' : 'días'}`}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-semibold text-slate-800">
                    {m.totalDays}
                    {m.totalDays !== m.legalDays && (
                      <div className="text-[10px] font-normal text-slate-400" title="Días que marca la LFT + bono por su antigüedad">
                        Ley: {m.legalDays}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-slate-500">{m.usedDays}<p className="mt-1 text-xs text-blue-700">{m.pendingHRDays > 0 ? `Incluye ${m.pendingHRDays} en revisión de RH` : 'Sin revisión de RH pendiente'}</p></TableCell>
                  <TableCell className="text-center">
                    <span className={m.pendingDays > 0 ? 'text-amber-600 font-semibold' : 'text-slate-400'}>{m.pendingDays}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`shadow-none border font-bold ${m.availableDays < 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-[#73C056]/10 text-[#5fa843] border-[#73C056]/20'}`}>
                      {m.availableDays}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-sm text-slate-600 whitespace-nowrap">
                    <span className="font-semibold text-slate-800">{m.nextPeriodDays}</span> días
                    <div className="text-[10px] text-slate-400">
                      desde {formatUTC(m.cycleEnd, "d MMM yy")}
                      {m.nextPeriodRequested > 0 && <span className="text-amber-600"> · {m.nextPeriodRequested} ya pedidos</span>}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
