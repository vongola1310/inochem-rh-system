import { PrismaClient } from "@prisma/client";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { processRequest } from "@/app/actions/manage-request";
import {
  cancelRequest,
  approveCancellation,
} from "@/app/actions/cancel-request";
import {
  CalendarDays,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  CheckCircle,
  FileText,
  User,
  ArrowLeft,
  Calendar,
  Download,
} from "lucide-react";
import { DownloadButton } from "@/components/pdf/download-button";
import Link from "next/link";
import { auth } from "@/auth";
import { RejectForm } from "@/components/reject-form";

const prisma = new PrismaClient();

const TYPE_LABELS: Record<string, string> = {
  VACATION: "Solicitud de Vacaciones",
  PERMIT_LATE: "Permiso para Llegar Tarde",
  PERMIT_EARLY: "Permiso para Salir Temprano",
  PERMIT_ABSENCE: "Permiso de Ausencia",
  PERMIT_BIRTHDAY: "Permiso de Cumpleaños",
  PERMIT_OTHER: "Permiso Especial",
};

function calculateDaysBreakdown(
  startDate: Date,
  returnDate: Date | null,
  holidays: Set<string>,
) {
  if (!returnDate) return { total: 0, weekends: 0, holidays: 0, business: 0 };

  const result = { total: 0, weekends: 0, holidays: 0, business: 0 };
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(returnDate);
  end.setHours(0, 0, 0, 0);
  const current = new Date(start);

  while (current < end) {
    result.total++;
    const dayOfWeek = current.getDay();
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;

    if (dayOfWeek === 0 || dayOfWeek === 6) result.weekends++;
    else if (holidays.has(dateStr)) result.holidays++;
    else result.business++;

    current.setDate(current.getDate() + 1);
  }
  return result;
}

// Params sin Promise (Next.js 14)
export default async function RequestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  const session = await auth();
  const currentUserEmail = session?.user?.email;
  const currentUserId = session?.user?.id;
  const currentUserRole = (session?.user as any)?.role;

  // 1. OBTENEMOS INFORMACIÓN COMPLETA
  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          balance: true,
          boss: {
            include: { backupUser: true }, // Para verificar respaldo
          },
        },
      },
    },
  });

  if (!request) return notFound();

  // 2. Cargamos festivos para desglose
  const allHolidays = await prisma.holiday.findMany();
  const holidayDates = new Set(
    allHolidays.map((h) => {
      const date = new Date(h.date);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }),
  );

  const isOwner = request.user.email === currentUserEmail;
  const isVacation = request.type === "VACATION";

  // Casting a string para evitar conflictos de tipado si Prisma Client no está actualizado al 100%
  const currentStatus = request.status as string;

  const canDownload =
    (request.approvedByBoss || request.approvedByHR) &&
    currentStatus !== "CANCELLED";
  const isApproved = currentStatus === "APPROVED";
  const isCancellationRequested = currentStatus === "CANCELLATION_REQUESTED";

  const breakdown =
    isVacation && request.returnDate
      ? calculateDaysBreakdown(
          request.startDate,
          request.returnDate,
          holidayDates,
        )
      : null;

  // --- LÓGICA DE PERMISOS PARA BOTONES (Quién ve qué) ---
  const isRequesterBoss = request.user.bossId === currentUserId;
  const isBossBackup = request.user.boss?.backupId === currentUserId;
  const isHR = currentUserRole === "HR";

  // Definimos si el usuario actual tiene permiso administrativo general sobre esta solicitud
  const isBossOrHR = isRequesterBoss || isBossBackup || isHR;

  // Variable Maestra: ¿Debo ver los botones de Aprobar/Rechazar?
  let showApprovalButtons = false;

  if (currentStatus === "PENDING_BOSS") {
    // Solo el Jefe o su Respaldo pueden aprobar en esta etapa
    if (isRequesterBoss || isBossBackup) {
      showApprovalButtons = true;
    }
    // Si RH es superusuario y quiere aprobar saltándose al jefe, descomenta:
    // if (isHR) showApprovalButtons = true
  } else if (currentStatus === "PENDING_HR") {
    // Solo RH puede aprobar en esta etapa
    if (isHR) {
      showApprovalButtons = true;
    }
    // EL JEFE YA NO VE BOTONES AQUÍ
  }
  // ----------------------------------------

  const getStatusInfo = () => {
    switch (currentStatus) {
      case "APPROVED":
        return {
          label: "Aprobado",
          color: "text-[#73C056]",
          bg: "bg-[#73C056]/10",
          border: "border-[#73C056]/20",
          icon: CheckCircle,
        };
      case "REJECTED":
        return {
          label: "Rechazado",
          color: "text-red-600",
          bg: "bg-red-50",
          border: "border-red-200",
          icon: XCircle,
        };
      case "PENDING_BOSS":
        return {
          label: "Firma de Jefe",
          color: "text-amber-600",
          bg: "bg-amber-50",
          border: "border-amber-200",
          icon: Clock,
        };
      case "PENDING_HR":
        return {
          label: "Validación RH",
          color: "text-blue-600",
          bg: "bg-blue-50",
          border: "border-blue-200",
          icon: Clock,
        };
      case "CANCELLED":
        return {
          label: "Cancelado",
          color: "text-slate-500",
          bg: "bg-slate-100",
          border: "border-slate-200",
          icon: XCircle,
        };
      case "CANCELLATION_REQUESTED":
        return {
          label: "Solicitó Cancelar",
          color: "text-orange-600",
          bg: "bg-orange-50",
          border: "border-orange-200",
          icon: AlertCircle,
        };
      default:
        return {
          label: currentStatus,
          color: "text-slate-600",
          bg: "bg-slate-50",
          border: "border-slate-200",
          icon: AlertCircle,
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/">
            <Button
              variant="ghost"
              className="text-slate-600 hover:text-[#73C056] hover:bg-[#73C056]/5 transition-all -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver al Panel
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/30">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant="outline"
                    className="bg-white text-slate-500 border-slate-200 shadow-sm"
                  >
                    Folio #{request.id.slice(-6).toUpperCase()}
                  </Badge>
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(request.createdAt, "d MMM yyyy, HH:mm", {
                      locale: es,
                    })}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 flex items-center gap-2">
                  {isVacation ? (
                    <CalendarDays className="h-8 w-8 text-[#73C056]" />
                  ) : (
                    <Clock className="h-8 w-8 text-amber-500" />
                  )}
                  {TYPE_LABELS[request.type] || "Solicitud"}
                </h1>
                <div className="flex items-center gap-2 text-slate-600 text-sm mt-2">
                  <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                    {request.user.name.charAt(0)}
                  </div>
                  <span className="font-medium text-slate-900">
                    {request.user.name}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">
                    {request.user.jobTitle || "Empleado"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <Badge
                  className={`text-sm px-4 py-1.5 font-semibold shadow-sm border ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}
                >
                  <StatusIcon className="w-4 h-4 mr-2" />
                  {statusInfo.label}
                </Badge>

                {canDownload && (
                  <div className="animate-in fade-in zoom-in duration-300">
                    <DownloadButton data={request} />
                  </div>
                )}
              </div>
            </div>

            {!canDownload &&
              currentStatus !== "REJECTED" &&
              currentStatus !== "CANCELLED" && (
                <div className="mt-6 flex items-start gap-3 text-sm text-amber-800 bg-amber-50/80 p-4 rounded-xl border border-amber-100">
                  <div className="bg-amber-100 p-1 rounded-full shrink-0">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">Documento en espera de firmas</p>
                    <p className="text-amber-700/80 text-xs mt-0.5">
                      {currentStatus === "PENDING_BOSS"
                        ? "El Jefe Inmediato debe autorizar primero."
                        : currentStatus === "PENDING_HR"
                          ? "El departamento de RH debe validar la solicitud."
                          : "Esperando procesamiento..."}
                    </p>
                  </div>
                </div>
              )}
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {isVacation ? (
              <div>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Detalles del Periodo
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-medium">
                      Inicia
                    </p>
                    <p className="text-xl font-bold text-slate-900 capitalize">
                      {format(request.startDate, "d 'de' MMMM", { locale: es })}
                    </p>
                    <p className="text-sm text-slate-400">
                      {format(request.startDate, "EEEE, yyyy", { locale: es })}
                    </p>
                  </div>

                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-colors">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-400"></div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-medium">
                      Regresa
                    </p>
                    <p className="text-xl font-bold text-slate-900 capitalize">
                      {request.returnDate
                        ? format(request.returnDate, "d 'de' MMMM", {
                            locale: es,
                          })
                        : "N/A"}
                    </p>
                    <p className="text-sm text-slate-400">
                      {request.returnDate
                        ? format(request.returnDate, "EEEE, yyyy", {
                            locale: es,
                          })
                        : ""}
                    </p>
                  </div>

                  <div className="bg-[#73C056]/5 rounded-xl p-5 border border-[#73C056]/20 shadow-sm flex flex-col justify-center items-center text-center">
                    <p className="text-xs text-[#73C056] uppercase tracking-wider mb-1 font-bold">
                      Días a descontar
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-[#73C056]">
                        {request.daysRequested}
                      </span>
                      <span className="text-sm font-medium text-[#73C056]">
                        hábiles
                      </span>
                    </div>
                  </div>
                </div>

                {breakdown && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          Total días
                        </p>
                        <p className="text-lg font-bold text-slate-800">
                          {breakdown.total}
                        </p>
                      </div>
                      <div className="border-x border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">
                          Fines de Semana
                        </p>
                        <p className="text-lg font-bold text-slate-600">
                          {breakdown.weekends}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          Días Festivos
                        </p>
                        <p className="text-lg font-bold text-slate-600">
                          {breakdown.holidays}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Detalle de Incidencia
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-medium">
                      Fecha del Permiso
                    </p>
                    <p className="text-xl font-bold text-slate-900 capitalize">
                      {format(request.startDate, "EEEE, d 'de' MMMM", {
                        locale: es,
                      })}
                    </p>
                    <p className="text-sm text-slate-400">
                      {format(request.startDate, "yyyy")}
                    </p>
                  </div>
                  {request.permitTime && (
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-purple-400"></div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-medium">
                        Horario Reportado
                      </p>
                      <div className="flex items-center gap-2">
                        <Clock className="h-6 w-6 text-purple-500" />
                        <p className="text-2xl font-bold text-slate-900">
                          {request.permitTime}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <AlertCircle className="h-4 w-4 shrink-0 text-slate-400" />
                  <p>
                    Los permisos no descuentan saldo de vacaciones
                    automáticamente, quedan a consideración de RH para nómina.
                  </p>
                </div>
              </div>
            )}

            <hr className="border-slate-100" />

            <div>
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Motivo / Observaciones
              </h2>
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-slate-700 italic leading-relaxed shadow-sm">
                "{request.observations || "Sin observaciones específicas"}"
              </div>
            </div>

            {request.rejectionReason && (
              <div className="animate-in slide-in-from-bottom-2 duration-500">
                <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <XCircle className="h-4 w-4" /> Motivo del Rechazo
                </h2>
                <div className="bg-red-50 p-6 rounded-xl border border-red-200 text-red-800 leading-relaxed shadow-sm">
                  {request.rejectionReason}
                </div>
              </div>
            )}
          </div>

          <CardFooter className="flex flex-col gap-3 border-t border-slate-100 p-6 bg-slate-50/30">
            {/* 1. ACCIONES PARA EL DUEÑO (CANCELAR) - CORREGIDO */}
            {isOwner &&
              currentStatus !== "CANCELLED" &&
              currentStatus !== "REJECTED" &&
              currentStatus !== "CANCELLATION_REQUESTED" && (
                <form
                  action={async (formData) => {
                    "use server";
                    await cancelRequest(formData);
                  }}
                  className="w-full"
                >
                  <input type="hidden" name="requestId" value={request.id} />
                  <Button
                    variant="destructive"
                    className="w-full gap-2 h-12 text-base font-medium shadow-sm hover:bg-red-600 transition-all rounded-xl"
                    type="submit"
                  >
                    <XCircle className="w-5 h-5" />
                    {isApproved
                      ? "Solicitar Cancelación (Ya aprobada)"
                      : "Cancelar Solicitud"}
                  </Button>
                  {isApproved && (
                    <p className="text-xs text-center mt-3 text-slate-500">
                      ⚠️ Requiere aprobación de RH para devolver los días al
                      saldo.
                    </p>
                  )}
                </form>
              )}

            {/* 2. ACCIONES DE APROBACIÓN (SOLO SI TE TOCA) */}

            {showApprovalButtons && (
              <div className="flex flex-col gap-3 w-full animate-in slide-in-from-bottom-2">
                <form action={processRequest} className="w-full">
                  <input type="hidden" name="requestId" value={request.id} />
                  <input type="hidden" name="action" value="APPROVE" />
                  <Button
                    className="w-full bg-[#73C056] hover:bg-[#62a847] text-white h-12 shadow-md font-bold rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5"
                    type="submit"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Autorizar y Firmar
                  </Button>
                </form>
                <RejectForm requestId={request.id} />
              </div>
            )}
            {/* 3. APROBACIÓN DE CANCELACIÓN (SOLO SI TE TOCA) - CORREGIDO */}
            {isBossOrHR && isCancellationRequested && (
              <div className="w-full bg-orange-50 p-5 rounded-xl border border-orange-200 text-center shadow-sm">
                <div className="flex justify-center mb-3">
                  <div className="bg-orange-100 p-2 rounded-full">
                    <AlertCircle className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
                <p className="text-sm text-orange-900 font-bold mb-4">
                  El empleado solicita cancelar estas vacaciones ya aprobadas.
                </p>
                <form
                  action={async (formData) => {
                    "use server";
                    await approveCancellation(formData);
                  }}
                >
                  <input type="hidden" name="requestId" value={request.id} />
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white w-full gap-2 h-12 shadow-sm rounded-xl font-bold"
                    type="submit"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Confirmar Cancelación y Devolver Días
                  </Button>
                </form>
              </div>
            )}
          </CardFooter>
        </div>
      </div>
    </div>
  );
}
