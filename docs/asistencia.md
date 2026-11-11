# Asistencia y ausencias

Reglas confirmadas el 23/10/2026:

- Jornada de lunes a viernes, 08:00–17:00, excluyendo festivos del sistema.
- Puntual hasta 08:10:59; retardo desde 08:11:00.
- No se asigna salida automática. Si falta entrada o salida, se conserva el registro faltante y se genera incidencia, salvo autorización o trabajo de campo suficiente.
- Si no hay entrada ni salida en un día laboral, se muestra **Falta** en la vista previa, el portal y el Excel. No se inventa una salida a las 17:00 cuando tampoco existe entrada. Se conserva el dictamen del jefe, y se respetan autorizaciones de día completo y N/A.
- Vacaciones y permisos con firma del jefe cubren su alcance aunque falte RH. Cancelados, rechazados y sin firma no justifican.
- Los retardos no se convierten en faltas. Los reportes muestran el rango y los días hábiles del periodo, con conteos separados por tipo de incidencia.
- Incapacidades: RH y ADMIN, fechas inclusivas, días corridos, serie, folio, tipo y notas. No se muestran datos médicos en el tablero general.

## Flujo

1. RH carga Ajusco y Periférico (CSV/XLSX/XLS), declara el periodo y revisa personas, cruces y datos normalizados. No se deducen faltas únicamente de quienes aparecen en los archivos: se confirma el padrón del periodo.
2. Números sin correspondencia se vinculan explícitamente o se excluyen con motivo. Se confirma responsable de dictamen por colaborador. El borrador no envía notificaciones.
3. RH publica una vista previa vigente. No se permite duplicar empleado/fecha entre periodos publicados. El colaborador recibe un aviso de consulta y el jefe recibe las incidencias pendientes de dictamen.
4. El colaborador consulta en modo lectura. El jefe/responsable justifica o confirma retardo, falta o salida anticipada y escribe el motivo, sin esperar una justificación del empleado.
5. RH consulta avance, gráficos y Excel. El resumen corresponde al periodo seleccionado y no trata decisiones pendientes como definitivas.

Las solicitudes aprobadas o incapacidades modificadas después de una publicación obligan a actualizar la evaluación antes de cerrar el reporte. Se conservan fuentes, decisiones anteriores y eventos de auditoría.

## Verificación realizada el 26/10/2026

- Lector probado con ambos archivos proporcionados y formatos Excel equivalentes, fechas y horas inválidas, duplicados, acentos y apóstrofos en IDs.
- Reglas probadas en límites horarios, festivos, cruces de mes, vacaciones, permisos parciales, Home Office, incapacidad y registros de salida faltantes.
- 40 pruebas unitarias y de regresión aprobadas (21 de asistencia, 11 de saldos y 8 de contraseñas).
- Flujo completo aprobado sobre PostgreSQL en un esquema temporal eliminado al finalizar, con usuarios ficticios: migración desde el esquema anterior, autorización por usuario/jefe/RH/ADMIN, publicación, devolución de justificación, dictamen, cierre, Excel con fechas y horas tipadas y textos sin fórmulas, doble envío concurrente, versiones y periodos duplicados.
- La misma integración verifica que agregar o retirar un festivo archive o reactive el día sin borrar su historial, y que modificar incapacidades conserve los dictámenes cuya evidencia no cambió.
- TypeScript sin errores y compilación de producción aprobada en copia aislada. Persisten advertencias anteriores de bcrypt en Edge y datos de compatibilidad de navegadores desactualizados.
- Interfaz verificada en Chrome a 1280 y 390 px: calendario de uno/dos meses, fechas inclusivas, padrón, bloqueo de publicación con cambios sin recalcular, filtro de vacaciones, reporte y gráficos accesibles. Inspección visual de capturas de escritorio y móvil.
- Migración aditiva revisable: nunca usar `db push --accept-data-loss` sobre la base conectada.

## Activación

Aplicada el 26/10/2026 mediante `scripts/activate-attendance.cjs`, en una transacción: cuatro tablas, cuatro tipos de enumeración y `PERMIT_HOME_OFFICE`. SHA-256 del SQL aplicado: `20095107ad401f464a72e71bddd1a0acda961b1f44ed81f9c8620c114a33ea1a`.

La verificación antes/después conservó 47 usuarios, 498 solicitudes, 47 saldos, 513 notificaciones y 8 festivos. Las cuatro tablas nuevas quedaron vacías. No se publicaron archivos reales ni se notificó a colaboradores durante la activación.

La base anterior no tiene una cadena de migraciones inicializada por este trabajo. El script aplica únicamente este SQL aditivo y rechaza estados parciales o una segunda aplicación; no sustituye un baseline de Prisma. No ejecutar `migrate deploy` sobre otra base existente sin revisar su historial. `prepare-attendance.ps1` genera una propuesta y verifica que coincida; nunca sobrescribe una migración ya aplicada.

## Primera carga de RH

1. Abrir **Incidencias / Periodos y reportes RH** (`/admin/attendance`), elegir 22/09/2026 a 06/10/2026 y cargar los dos originales en la sede correspondiente.
2. Confirmar el padrón: excluir con motivo cuentas técnicas o personas fuera del alcance. El diagnóstico inicial incluyó todas las cuentas y no representa faltas definitivas.
3. Resolver dos números sin correspondencia automática: **Ajusco 33150** y **Periférico 00**. Vincularlos al colaborador correcto o excluirlos con motivo. No se adivina la identidad por nombre.
4. Asignar responsable a cualquier colaborador con incidencias que no tenga jefe registrado. Revisar vacaciones, permisos firmados e incapacidades antes de publicar.
5. Guardar y recalcular, revisar la tabla y marcar la confirmación. Solo entonces se envían notificaciones internas al portal.

Las incapacidades se administran en `/admin/medical-leaves` (RH y ADMIN). La consulta del colaborador y revisión del jefe están en `/attendance`. El reporte del periodo puede ser provisional; pendientes y evaluaciones desactualizadas no cuentan como dictámenes confirmados.

## Responsable del dictamen: búsqueda y N/A

El selector permite escribir el nombre o número de empleado, sin distinguir mayúsculas ni acentos. Admite selección por teclado y excluye al propio colaborador de los responsables disponibles.

Por confirmación del usuario, **N/A — No aplica** conserva las checadas y excluye a esa persona del proceso de incidencias en el periodo configurado. No solicita justificación, no envía notificaciones de incidencias y no acumula retardos, faltas, equivalencias ni pendientes. La selección queda guardada explícitamente en el borrador, aunque exista un jefe en el perfil. Puede sustituirse por un responsable mientras se edita el borrador.

El reporte y el Excel muestran N/A y cuentan por separado sus días. Las observaciones iniciales y las marcaciones originales se conservan como evidencia. Una actualización de permisos, incapacidad o calendario mantiene la exclusión. Esta ampliación usa los campos JSON existentes y no requiere otra migración.

Validación de esta ampliación: 24 pruebas de reglas aprobadas (incluidas tres de N/A), dos flujos de integración completos en PostgreSQL temporal y comprobaciones de búsqueda, acentos, número de empleado, teclado, guardado y persistencia en Chrome de escritorio/móvil. No se modificaron periodos reales ni se enviaron avisos durante las pruebas.

## Vista por líder (27/10/2026)

La vista previa y el reporte se organizan como **líder / responsable del dictamen → colaboradores → días del periodo**. Los grupos se identifican por ID, por lo que dos jefes con el mismo nombre no mezclan sus equipos. Se respeta el responsable guardado en cada día del periodo, aunque posteriormente cambie el jefe del perfil. N/A y sin responsable son grupos separados.

Hay búsqueda por jefe, colaborador, número o fecha; filtros por estado e incidencias; y controles para expandir/contraer líderes. Cada equipo y colaborador muestra etiquetas de faltas en rojo, retardos en naranja y días sin incidencias en verde. El detalle conserva checadas reales, registros faltantes, justificación y dictamen. El resumen del periodo y los gráficos están en un panel desplegable independiente; los contadores de los equipos corresponden al periodo mostrado.

ADMIN y RH pueden consultar periodos, vista previa, reportes y descargar Excel. Las operaciones de carga, configuración, publicación, actualización y cierre permanecen exclusivas de RH. Los colaboradores conservan el acceso a su propia asistencia y los responsables a sus dictámenes asignados.

Verificado: 28 pruebas de reglas/agrupación, tres flujos de integración en PostgreSQL temporal (incluida autorización de descarga), TypeScript, compilación aislada y cuatro comprobaciones visuales/funcionales de escritorio y móvil. No requiere migración ni modifica los registros de asistencia existentes.

## Repetir comprobaciones

```powershell
node --test tests/attendance-engine.test.cjs tests/attendance-grouping.test.cjs tests/vacation-balances.test.cjs tests/reset-employee-password.test.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
powershell -NoProfile -File scripts/test-attendance-integration.ps1
node scripts/activate-attendance.cjs
```

El último comando es solo lectura sin `--apply`. La integración requiere permisos para crear/eliminar su propio esquema temporal; no usa registros reales. El esquema anterior de prueba está versionado en `tests/fixtures/schema-before-attendance.prisma` para que la comprobación no dependa de HEAD ni de archivos externos.


## Filtros, lista negra y dictamen directo (27/10/2026)

- Filtro por permisos (incluye Home Office), salidas anticipadas, faltas, vacaciones y retardos, combinado con búsqueda y estado. RH/ADMIN lo ven en la agrupación por líder; empleado/jefe también filtran antes de paginar. Faltas/retardos/salidas usan el dictamen vigente si están resueltos; los justificados no aparecen como incidencias activas.
- RH puede enviar a lista negra desde Usuarios o el perfil y restaurar al colaborador. El directorio permite Activos, Lista negra y Todos. Hay confirmación con el nombre del colaborador y auditoría de ambas operaciones.
- La exclusión es inmediata en consultas y reportes de incidencias, incluyendo el resumen del periodo. Las checadas originales, solicitudes y dictámenes anteriores se conservan. Los IDs de checador reconocidos como lista negra se excluyen automáticamente, incluso en configuraciones antiguas. RH debe actualizar los periodos afectados antes de descargar su Excel definitivo. No se notifica al colaborador excluido al recalcular.
- Publicar o actualizar notifica al empleado para consulta y al jefe para dictaminar. La acción anterior de justificación del empleado rechaza escrituras. El jefe puede atender pendientes tanto nuevos como heredados de WAITING_EMPLOYEE. No existe devolución al colaborador; los textos históricos se conservan.
- La migración 202610270001_employee_blacklist agrega únicamente User.isBlacklisted y User.blacklistedAt. Activada mediante scripts/activate-employee-blacklist.cjs con SHA-256 f915abb381b0b3c432bac63225c61437e2921d622a532f89a723627553eb0b6c. Se conservaron todos los campos y los 47 usuarios existentes; ninguno se envió a lista negra.
- Validación: 30 pruebas de reglas/filtros y 5 integraciones PostgreSQL aisladas, autorización, doble dictamen concurrente, notificación a ambos participantes, Excel, exclusión/restauración sin cambios al historial y equivalencia de filtros SQL/UI. TypeScript y compilación aislada aprobados; interfaz comprobada en escritorio/móvil.

## Omitir IDs sin correspondencia por ahora

En el borrador RH puede pulsar **Omitir por ahora** junto a un ID desconocido, o **Omitir IDs sin correspondencia por ahora** en el aviso de validación. Se prepara una exclusión con motivo automático, pendiente de identificar, usando la combinación sede + ID. Después debe guardar la configuración y recalcular antes de confirmar la publicación. Las vinculaciones conocidas y el padrón no se modifican; las fuentes originales permanecen intactas.

La omisión solo corresponde a ese periodo y queda en la configuración auditada. Mientras siga en borrador, **Volver a vincular** permite deshacerla. En otro periodo los IDs deben revisarse nuevamente. Se verificaron omisión individual y conjunta, reversión antes/después de guardar, conservación de checadas, bloqueo de publicación con cambios pendientes y alcance por periodo en Chrome de escritorio/móvil; TypeScript sin errores.

## Personal de campo Salesforce y limpieza de periodos (28/10/2026)

- Gibran (empleado 33028), RH y ADMIN pueden **guardar archivos de referencia de personal de campo** desde el menú lateral y corregir sus correspondencias. RH y ADMIN también consultan los reportes de los demás responsables. El permiso se verifica contra el rol vigente y la autorización de campo en la base en cada acción; no basta el rol guardado en la sesión. Los colaboradores comunes y las cuentas en lista negra no pueden cargar reportes. Los recordatorios siguen destinados al responsable de campo habilitado.
- La carga admite el formato original SA_RH (.xlsx/.xls, 3 MB). Conserva las 10 columnas, los horarios originales, la sede documental (hoja y fila), números de cita/orden y hash del archivo. Sugiere correspondencias por nombre completo normalizado (incluido orden de apellidos/nombres); las coincidencias ambiguas requieren elección, y las omisiones requieren motivo.
- Regla confirmada por el usuario: se consideran los horarios válidos y todos los días entre inicio y fin. Se suman servicios y tiempo en oficina sin superposición. **6 horas o más** cumplen asistencia; menos de 6 generan incidencia. En servicios de varios días se usan los intervalos reales dentro de la jornada de cada día. El estado Salesforce se conserva como referencia; los intervalos incompletos, inválidos, duplicados, futuros o fuera de periodo se señalan y excluyen según corresponda.
- La carga guarda inmediatamente el Excel original y sus datos como referencia, sin confirmación adicional, días precalculados, creación de incidencias ni cambios de dictamen. El original puede descargarse con control de acceso y validación SHA-256. Los reportes del flujo anterior siguen disponibles; si no conservaron los bytes originales, solo muestran sus datos interpretados. Volver a cargar el mismo archivo y periodo recupera el original sin duplicar la referencia ni recalcular. Los borradores anteriores se pueden activar como referencia, sin calcular.
- Al importar o actualizar biochecadores se leen las referencias guardadas que coinciden con el periodo, se expanden sus intervalos y se cruzan con Ajusco/Periférico y las autorizaciones vigentes. Ahí se aplican calendario, fecha de ingreso, lista negra y N/A. Las correspondencias pendientes bloquean la publicación, pero no la conservación del archivo. La vista previa identifica los archivos de campo utilizados. No se duplican días por servicios/reportes coincidentes.
- La campana consulta los vencimientos del responsable. Primer vencimiento: 28/10/2026. Guardar el archivo programa el siguiente para 14 días después; si sigue pendiente, el aviso se renueva cada 14 días. La creación es transaccional y no duplica avisos por tener varias pestañas. No se envía correo ni se requiere una tarea del navegador abierta continuamente; los avisos vencidos aparecen al consultar la campana o abrir el módulo.
- El reporte RH agrega respaldo de campo por día, citas y horarios de referencia en Excel, recuento del periodo de fechas respaldadas y filtro **Trabajo de campo**. N/A y lista negra mantienen sus exclusiones. Empleado de solo lectura y dictamen exclusivo del responsable se conservan.
- **Eliminar periodo**, en la lista de periodos de asistencia, pide escribir ELIMINAR. HR/ADMIN pueden borrar el periodo elegido, sus días, dictámenes y notificaciones, con una constancia de eliminación. Libera la combinación empleado/fecha para volver a importar y retira esos registros de los acumulados. No borra usuarios, solicitudes, vacaciones ni incapacidades.
- **Eliminar reporte de campo**, dentro del reporte, requiere la misma confirmación y puede usarlo el responsable dueño, RH o ADMIN. Elimina la referencia y los posibles días precalculados del flujo anterior, sin borrar los periodos de biochecador. Se conserva la constancia de auditoría. Agregar, modificar, cancelar o eliminar referencias marca los periodos afectados como pendientes de actualización; los días, dictámenes y avisos de asistencia no cambian hasta que RH actualiza el cruce desde Biochecadores.
- Migración aditiva `202610280001_field_reports` activada con SHA-256 `94d15a806707c383293a26dd2e57f8f6038f27ec012c48001939e8b18d48faa3`: tres tablas y el permiso en User. Se conservaron 47 usuarios, 2 periodos, 473 días de asistencia, 505 solicitudes y 574 notificaciones existentes. No se borraron periodos reales ni se confirmó el archivo del usuario durante las pruebas.
- Verificación: reglas de lector/cruce, integraciones PostgreSQL en esquema temporal, recordatorios concurrentes, autorización, Excel, borrado y reimportación, corrección de festivos; interfaces de escritorio/móvil y compilación aislada. El cliente Prisma se regeneró con el servidor detenido y después se reinició el servidor en el puerto 3000.


## Reglas vigentes desde el 29 de octubre de 2026

- RH y ADMIN administran `/admin/reduced-workdays`: fechas, horario, sede Ajusco/Periférico/ambas y notas. No se permiten jornadas solapadas para una sede. Editar o cancelar conserva auditoría y marca periodos afectados para actualizar el cruce.
- La jornada reducida se aplica por la sede asignada en el padrón; en automático se infiere de checadas e identidades. Si no se puede determinar la sede y los horarios difieren, RH debe seleccionarla. N/A permanece excluido.
- Para servicios de un solo día se usa Working Hours, o Actual Duration (Net Hours) si no existe; a falta de ambos se usa el intervalo. Para varios días se recorta cada intervalo real a la jornada de ese día. Se conserva cuenta/lugar, cita, tipo y fila de origen.
- El tiempo de oficina se obtiene de parejas de checadas ordenadas, limitado a la jornada, descontando intervalos de servicios. Si faltan parejas no se atribuye tiempo incierto. Citas repetidas entre archivos se cuentan una vez; contradicciones y servicios superpuestos se señalan para dictamen.
- El umbral de campo más oficina es 6 horas, inclusive. No se infieren retardos de Salesforce. Vacaciones, permisos completos firmados e incapacidades mantienen su cobertura. El jefe puede confirmar «Incidencia» para registros faltantes u horas insuficientes; el empleado permanece en consulta.
- Los archivos de campo siguen siendo referencias: subirlos no calcula ni modifica dictámenes. El cruce se ejecuta al cargar o actualizar biochecadores.
- La activación marca periodos publicados para actualizar; no reescribe dictámenes automáticamente. Al actualizar, los cambios de evidencia se auditan y regresan al flujo de revisión cuando corresponde.

### Verificación de esta entrega

- 46 pruebas de reglas, lectura, agrupación y horas combinadas aprobadas.
- 14 escenarios de integración PostgreSQL aprobados en esquemas temporales: los 12 existentes y los 2 nuevos de jornadas/dictamen.
- TypeScript sin errores y compilación de producción aislada completada.
- Vistas de líderes y jornadas revisadas en escritorio y móvil, incluyendo calendario y edición.
- Activación aditiva de ReducedWorkday y AttendanceDecision.INCIDENT completada. Un periodo publicado quedó pendiente de actualizar. Se verificó mediante conteos y huellas de contenido que usuarios, solicitudes, incapacidades, checadas, reportes de campo y notificaciones se conservaron.
