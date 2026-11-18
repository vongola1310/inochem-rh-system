# Cancelación de vacaciones

Acceso del colaborador: `/vacations/cancellations`, desde el menú y Gestionar mis solicitudes. Incluye filtros por solicitudes vigentes, cancelaciones en revisión, canceladas y todo el historial. Solo muestra vacaciones del usuario autenticado.

- PENDING_BOSS y PENDING_HR: el titular indica motivo y confirma la cancelación completa. Se actualiza el saldo del ciclo correspondiente.
- APPROVED: el titular solicita cancelación; el estado pasa a CANCELLATION_REQUESTED y los días continúan comprometidos.
- RH revisa en `/vacations/cancellations?view=review`. Puede confirmar la cancelación o rechazarla con motivo. Al rechazar, regresa a APPROVED, conservando firmas y saldo.
- Motivos, decisiones, fecha y responsable se conservan en las observaciones. Se avisa al jefe y a RH de la solicitud, y al colaborador y al jefe del resultado.
- Estado, saldo y notificaciones se guardan en la misma transacción serializable. El estado esperado evita devolver días o emitir avisos dos veces. Los periodos de asistencia afectados quedan pendientes de actualizar.
- El cambio usa el esquema actual y conserva las solicitudes; no elimina registros ni requiere migración.

Verificado con pruebas de saldos e integración en esquema temporal: titular, permisos, motivos, rechazo, doble confirmación concurrente y notificaciones. Revisión visual del portal de colaborador y RH en escritorio y móvil.

El titular puede retirar una petición CANCELLATION_REQUESTED con «Sí disfruté las vacaciones: retirar cancelación». Vuelve a APPROVED sin devolver días; conserva firmas e historial y notifica a RH y al jefe. No reactiva vacaciones que RH ya haya cancelado.
