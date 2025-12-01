/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// CORRECCIÓN: Estilos explícitos para evitar "Invalid border style"
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  
  // Header: Usamos borderWidth y borderStyle explícitos
  headerBox: { borderWidth: 1, borderStyle: 'solid', padding: 10, marginBottom: 20, textAlign: 'center', backgroundColor: '#f8f9fa' },
  title: { fontSize: 14, fontWeight: 'bold' },
  subTitle: { fontSize: 10, marginTop: 4, color: '#555' },
  
  // Tabla: Bordes explícitos
  table: { display: 'flex', width: 'auto', borderStyle: 'solid', borderWidth: 1, borderRightWidth: 0, borderBottomWidth: 0, marginBottom: 20 },
  tableRow: { margin: 'auto', flexDirection: 'row' },
  tableCol: { borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0 },
  
  cellLabel: { backgroundColor: '#e9ecef', padding: 5, fontSize: 8, fontWeight: 'bold' },
  cellValue: { padding: 6, fontSize: 10 },

  // Sección de Firmas
  signatureSection: { marginTop: 60, flexDirection: 'row', justifyContent: 'space-between' },
  
  // CORRECCIÓN: borderTopWidth en lugar de borderTop
  signatureBox: { width: '30%', borderTopWidth: 1, borderTopStyle: 'solid', borderColor: '#000', textAlign: 'center', paddingTop: 5, fontSize: 8 },
  stamp: { color: 'blue', fontSize: 7, marginTop: 2, fontStyle: 'italic' },
});

interface RequestData {
  id: string;
  type: string;
  createdAt: Date;
  startDate: Date;
  returnDate: Date | null;
  daysRequested: number;
  observations: string | null;
  permitTime: string | null;
  user: { name: string; jobTitle: string | null; employeeNumber: string | null };
  approvedByBoss: boolean;
  bossApprovalDate: Date | null;
  approvedByHR: boolean;
  hrApprovalDate: Date | null;
}

export const RequestDocument = ({ data }: { data: RequestData }) => {
  const isVacation = data.type === 'VACATION';
  const docCode = isVacation ? 'FO03PNO04-RH' : 'FO02PNO04-RH';
  const docTitle = isVacation ? 'SOLICITUD DE VACACIONES' : 'SOLICITUD DE PERMISO';

  const TableCell = ({ label, value, width = '100%' }: any) => (
    <View style={{ ...styles.tableCol, width }}>
      <Text style={styles.cellLabel}>{label}</Text>
      <View style={styles.cellValue}>
        {typeof value === 'string' ? <Text>{value}</Text> : value}
      </View>
    </View>
  );

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        {/* ENCABEZADO */}
        <View style={styles.headerBox}>
          <Text style={styles.title}>INOCHEM - SISTEMA DE CALIDAD</Text>
          <Text style={styles.subTitle}>{docTitle} ({docCode})</Text>
        </View>

        {/* DATOS GENERALES */}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <TableCell width="60%" label="NOMBRE DEL EMPLEADO" value={data.user.name} />
            <TableCell width="20%" label="NO. EMPLEADO" value={data.user.employeeNumber || 'S/N'} />
            <TableCell width="20%" label="FECHA SOLICITUD" value={format(data.createdAt, 'dd/MM/yyyy')} />
          </View>
        </View>

        {/* DETALLE */}
        <View style={styles.table}>
          {isVacation ? (
            <View style={styles.tableRow}>
              <TableCell width="33%" label="INICIO DE VACACIONES" value={format(data.startDate, 'dd MMMM yyyy', { locale: es }).toUpperCase()} />
              <TableCell width="33%" label="REANUDO LABORES" value={data.returnDate ? format(data.returnDate, 'dd MMMM yyyy', { locale: es }).toUpperCase() : 'N/A'} />
              <TableCell width="34%" label="DÍAS SOLICITADOS" value={`${data.daysRequested} DÍAS HÁBILES`} />
            </View>
          ) : (
            <>
              <View style={styles.tableRow}>
                <View style={{ ...styles.tableCol, width: '100%', padding: 8 }}>
                  <Text style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 4 }}>TIPO DE PERMISO:</Text>
                  <View style={{ flexDirection: 'row', gap: 15, fontSize: 9 }}>
                    <Text>{data.type === 'PERMIT_LATE' ? '[ X ]' : '[   ]'} Llegar tarde</Text>
                    <Text>{data.type === 'PERMIT_EARLY' ? '[ X ]' : '[   ]'} Salir temprano</Text>
                    <Text>{data.type === 'PERMIT_ABSENCE' ? '[ X ]' : '[   ]'} Faltar</Text>
                    <Text>{data.type === 'PERMIT_BIRTHDAY' ? '[ X ]' : '[   ]'} Cumpleaños</Text>
                    <Text>{data.type === 'PERMIT_OTHER' ? '[ X ]' : '[   ]'} Otro</Text>
                  </View>
                </View>
              </View>
              <View style={styles.tableRow}>
                 <TableCell width="50%" label="FECHA DEL PERMISO" value={format(data.startDate, 'dd MMMM yyyy', { locale: es }).toUpperCase()} />
                 <TableCell width="50%" label="HORARIO ESPECÍFICO" value={data.permitTime || 'N/A'} />
              </View>
            </>
          )}

          <View style={styles.tableRow}>
             <TableCell width="100%" label={isVacation ? "OBSERVACIONES" : "MOTIVO / JUSTIFICACIÓN"} value={data.observations || 'Sin observaciones'} />
          </View>
        </View>

        {/* FIRMAS */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <Text>{data.user.name}</Text>
            <Text style={styles.stamp}>Firma Digital (ID: {data.user.employeeNumber})</Text>
            <Text style={{ marginTop: 5, fontWeight: 'bold' }}>SOLICITANTE</Text>
          </View>

          <View style={styles.signatureBox}>
            {data.approvedByBoss ? (
                <>
                    <Text>AUTORIZADO</Text>
                    <Text style={styles.stamp}>{format(data.bossApprovalDate!, 'dd/MM/yyyy HH:mm')}</Text>
                </>
            ) : <Text style={{color: '#ccc'}}>Pendiente</Text>}
            <Text style={{ marginTop: 5, fontWeight: 'bold' }}>JEFE INMEDIATO</Text>
          </View>

          <View style={styles.signatureBox}>
             {data.approvedByHR ? (
                <>
                    <Text>VALIDADO</Text>
                    <Text style={styles.stamp}>{format(data.hrApprovalDate!, 'dd/MM/yyyy HH:mm')}</Text>
                </>
            ) : <Text style={{color: '#ccc'}}>Pendiente</Text>}
            <Text style={{ marginTop: 5, fontWeight: 'bold' }}>RECURSOS HUMANOS</Text>
          </View>
        </View>

        <Text style={{ position: 'absolute', bottom: 30, left: 40, fontSize: 8, color: '#999' }}>
           Folio Digital: {data.id} | Generado el: {format(new Date(), 'dd/MM/yyyy HH:mm')}
        </Text>
      </Page>
    </Document>
  );
};