/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { formatUTC, formatMXTime, formatMXDate } from '@/lib/format-date';
import { es } from 'date-fns/locale';

// ESTILOS DE ALTA PRECISIÓN (HOJA CARTA COMPLETA)
const styles = StyleSheet.create({
  page: { 
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 40,
    paddingRight: 40,
    fontSize: 9, 
    fontFamily: 'Helvetica',
    color: '#000',
    flexDirection: 'column',
  },
  
  // HEADER (TABLA 3 COLUMNAS)
  headerTable: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 30,
    height: 60
  },
  
  col1: { width: '25%', borderRightWidth: 1, borderColor: '#000', flexDirection: 'column' },
  logoContainer: { height: '70%', justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderColor: '#000', padding: 2 },
  vigenciaContainer: { height: '30%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },

  col2: { width: '50%', borderRightWidth: 1, borderColor: '#000', flexDirection: 'column' },
  rowProceso: { height: '25%', borderBottomWidth: 1, borderColor: '#000', justifyContent: 'center', alignItems: 'center' },
  rowTitulo: { height: '50%', borderBottomWidth: 1, borderColor: '#000', justifyContent: 'center', alignItems: 'center' },
  rowRevision: { height: '25%', justifyContent: 'center', alignItems: 'center' },

  col3: { width: '25%', flexDirection: 'column' },
  rowCodigo: { height: '33.33%', borderBottomWidth: 1, borderColor: '#000', justifyContent: 'center', paddingLeft: 5 },
  rowPagina: { height: '33.33%', borderBottomWidth: 1, borderColor: '#000', justifyContent: 'center', paddingLeft: 5 },
  rowVersion: { height: '33.33%', justifyContent: 'center', paddingLeft: 5 },

  headerLabel: { fontSize: 6, color: '#444' },
  headerValue: { fontSize: 8, fontWeight: 'bold' },
  headerTitleText: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },

  // CUERPO PRINCIPAL
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    marginBottom: 25, 
    textTransform: 'uppercase',
    textDecoration: 'underline'
  },
  
  label: { fontSize: 8, fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase', color: '#333' },
  
  inputBox: { 
    borderWidth: 1, 
    borderColor: '#000', 
    backgroundColor: '#f4f7fa',
    padding: 6, 
    minHeight: 22,
    justifyContent: 'center'
  },
  inputText: { fontSize: 10, fontFamily: 'Helvetica-Bold' },

  dateBoxContainer: { width: '30%' },
  
  observationsContainer: {
    marginTop: 30,
    flexGrow: 1, 
  },
  observationsBox: {
    borderWidth: 1, 
    borderColor: '#000', 
    backgroundColor: '#fff',
    padding: 8, 
    minHeight: 120,
    alignItems: 'flex-start'
  },

  // APROBACIÓN SIMPLE (REEMPLAZA LAS FIRMAS)
  finalApprovalBox: {
    marginTop: 'auto', // Empuja al fondo
    marginBottom: 20,
    padding: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9'
  },
  finalApprovalText: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  finalApprovalSubtext: {
    fontSize: 9,
    color: '#444',
    marginTop: 5
  },

  // UTILIDADES
  checkboxRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, padding: 5 },
  checkboxItem: { flexDirection: 'row', alignItems: 'center' },
  box: { width: 10, height: 10, borderWidth: 1, borderColor: '#000', marginRight: 4, justifyContent: 'center', alignItems: 'center', fontSize: 8 },

  footer: { position: 'absolute', bottom: 15, left: 40, right: 40, textAlign: 'center', fontSize: 7, color: '#999', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 5 }
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

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        
        {/* === HEADER === */}
        <View style={styles.headerTable}>
            <View style={styles.col1}>
                <View style={styles.logoContainer}>
                    <Image src="/logo-inochem.png" style={{ width: 90, height: 'auto' }} />
                </View>
                <View style={styles.vigenciaContainer}>
                    <Text style={{ fontSize: 6 }}>Vigente a partir de: OCT-2024</Text>
                </View>
            </View>
            <View style={styles.col2}>
                <View style={styles.rowProceso}>
                    <Text style={styles.headerLabel}>Proceso: Recursos Humanos</Text>
                </View>
                <View style={styles.rowTitulo}>
                    <Text style={styles.headerTitleText}>{docTitle}</Text>
                </View>
                <View style={styles.rowRevision}>
                    <Text style={styles.headerLabel}>Próxima revisión: OCT-2027</Text>
                </View>
            </View>
            <View style={styles.col3}>
                <View style={styles.rowCodigo}>
                    <Text style={styles.headerLabel}>Código: <Text style={styles.headerValue}>{docCode}</Text></Text>
                </View>
                <View style={styles.rowPagina}>
                    <Text style={styles.headerLabel}>Página: <Text style={styles.headerValue}>1 de 1</Text></Text>
                </View>
                <View style={styles.rowVersion}>
                    <Text style={{ fontSize: 6, color: '#444' }}>Versión: Nuevo</Text>
                    <Text style={{ fontSize: 6, color: '#444' }}>Sustituye a: N/A</Text>
                </View>
            </View>
        </View>

        <Text style={styles.sectionTitle}>{docTitle}</Text>

        {/* === FECHA DE ELABORACIÓN === */}
        <View style={{ alignItems: 'flex-end', marginBottom: 20 }}>
            <View style={{ width: 120 }}>
                <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#000', backgroundColor: '#fff' }}>
                    <View style={{ flex: 1, borderRightWidth: 1, padding: 4, alignItems: 'center' }}>
                        <Text style={styles.inputText}>{formatUTC(new Date(data.createdAt), 'dd')}</Text>
                    </View>
                    <View style={{ flex: 1, borderRightWidth: 1, padding: 4, alignItems: 'center' }}>
                        <Text style={styles.inputText}>{formatUTC(new Date(data.createdAt), 'MM')}</Text>
                    </View>
                    <View style={{ flex: 1.5, padding: 4, alignItems: 'center' }}>
                        <Text style={styles.inputText}>{formatUTC(new Date(data.createdAt), 'yyyy')}</Text>
                    </View>
                </View>
                <Text style={{ fontSize: 7, textAlign: 'center', marginTop: 3, fontWeight: 'bold' }}>FECHA DE ELABORACIÓN</Text>
            </View>
        </View>

        {/* === EMPLEADO === */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25 }}>
            <Text style={{ ...styles.label, width: 120 }}>NOMBRE DEL EMPLEADO:</Text>
            <View style={{ ...styles.inputBox, flex: 1 }}>
                <Text style={styles.inputText}>{data.user.name}</Text>
            </View>
        </View>

        {/* === CUERPO DEL FORMATO === */}
        {isVacation ? (
            <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={styles.dateBoxContainer}>
                        <View style={{ borderWidth: 1, borderColor: '#000', marginBottom: 4 }}>
                           <View style={{ flexDirection: 'row', backgroundColor: '#fff' }}>
                              <View style={{ flex: 1, padding: 5, alignItems: 'center', borderRightWidth: 1 }}><Text style={styles.inputText}>{formatUTC(new Date(data.startDate), 'dd')}</Text></View>
                              <View style={{ flex: 1, padding: 5, alignItems: 'center', borderRightWidth: 1 }}><Text style={styles.inputText}>{formatUTC(new Date(data.startDate), 'MM')}</Text></View>
                              <View style={{ flex: 1.5, padding: 5, alignItems: 'center' }}><Text style={styles.inputText}>{formatUTC(new Date(data.startDate), 'yyyy')}</Text></View>
                           </View>
                        </View>
                        <Text style={{ fontSize: 8, textAlign: 'center', fontWeight: 'bold', backgroundColor: '#eee', padding: 2 }}>INICIO DE VACACIONES</Text>
                    </View>

                    <View style={{ width: '25%', alignItems: 'center', justifyContent: 'flex-end' }}>
                         <View style={{ borderWidth: 1, width: '100%', padding: 5, alignItems: 'center', marginBottom: 4, backgroundColor: '#eaf4fc' }}>
                            <Text style={{ ...styles.inputText, fontSize: 12 }}>{data.daysRequested}</Text>
                         </View>
                         <Text style={{ fontSize: 8, textAlign: 'center', fontWeight: 'bold', backgroundColor: '#eee', padding: 2, width: '100%' }}>NÚMERO DE DÍAS</Text>
                    </View>

                    <View style={styles.dateBoxContainer}>
                         <View style={{ borderWidth: 1, borderColor: '#000', marginBottom: 4 }}>
                           <View style={{ flexDirection: 'row', backgroundColor: '#fff' }}>
                              <View style={{ flex: 1, padding: 5, alignItems: 'center', borderRightWidth: 1 }}><Text style={styles.inputText}>{data.returnDate ? formatUTC(new Date(data.returnDate), 'dd') : '-'}</Text></View>
                              <View style={{ flex: 1, padding: 5, alignItems: 'center', borderRightWidth: 1 }}><Text style={styles.inputText}>{data.returnDate ? formatUTC(new Date(data.returnDate), 'MM') : '-'}</Text></View>
                              <View style={{ flex: 1.5, padding: 5, alignItems: 'center' }}><Text style={styles.inputText}>{data.returnDate ? formatUTC(new Date(data.returnDate), 'yyyy') : '-'}</Text></View>
                           </View>
                        </View>
                        <Text style={{ fontSize: 8, textAlign: 'center', fontWeight: 'bold', backgroundColor: '#eee', padding: 2 }}>REANUDO LABORES</Text>
                    </View>
                </View>
            </View>
        ) : (
            <View style={{ marginBottom: 10 }}>
                <View style={{ marginBottom: 15 }}>
                    <Text style={{ ...styles.label, marginBottom: 8 }}>INDIQUE TIPO DE PERMISO:</Text>
                    <View style={{ flexDirection: 'row', gap: 20, paddingLeft: 10 }}>
                         <Text style={styles.headerValue}>{data.type === 'PERMIT_LATE' ? '[ X ]' : '[   ]'} Llegar tarde</Text>
                         <Text style={styles.headerValue}>{data.type === 'PERMIT_EARLY' ? '[ X ]' : '[   ]'} Salir temprano</Text>
                         <Text style={styles.headerValue}>{data.type === 'PERMIT_ABSENCE' ? '[ X ]' : '[   ]'} Faltar</Text>
                         <Text style={styles.headerValue}>{data.type === 'PERMIT_BIRTHDAY' ? '[ X ]' : '[   ]'} Cumpleaños</Text>
                         <Text style={styles.headerValue}>{data.type === 'PERMIT_OTHER' ? '[ X ]' : '[   ]'} Otro</Text>
                    </View>
                </View>
                
                <View style={{ flexDirection: 'row', marginTop: 10, justifyContent: 'space-between' }}>
                    <View style={{ width: '45%' }}>
                         <Text style={styles.label}>FECHA DE PERMISO:</Text>
                         <View style={styles.inputBox}><Text style={styles.inputText}>{formatUTC(new Date(data.startDate), 'dd/MM/yyyy')}</Text></View>
                    </View>
                    <View style={{ width: '45%' }}>
                         <Text style={styles.label}>HORARIO (SI APLICA):</Text>
                         <View style={styles.inputBox}><Text style={styles.inputText}>{data.permitTime || 'N/A'}</Text></View>
                    </View>
                </View>
            </View>
        )}

        {/* === OBSERVACIONES === */}
        <View style={styles.observationsContainer}>
            <Text style={styles.label}>OBSERVACIONES:</Text>
            <View style={styles.observationsBox}>
                <Text style={styles.inputText}>{data.observations || 'Sin observaciones adicionales.'}</Text>
            </View>
        </View>

        {/* === APROBACIÓN FINAL SIMPLE (SIN CUADROS) === */}
        <View style={styles.finalApprovalBox}>
            <Text style={styles.finalApprovalText}>ESTA SOLICITUD HA SIDO APROBADA</Text>
            <View style={{ flexDirection: 'row', gap: 40, marginTop: 5 }}>
                <Text style={styles.finalApprovalSubtext}>
                   SOLICITANTE: {data.user.name}
                </Text>
                <Text style={styles.finalApprovalSubtext}>
                   AUTORIZÓ: {data.bossApprovalDate ? formatUTC(new Date(data.bossApprovalDate), 'dd/MM/yyyy') : 'SISTEMA'}
                </Text>
            </View>
        </View>

        {/* PIE DE PÁGINA */}
        <View style={styles.footer}>
             <Text>Revvity Proprietary Information | Folio: {data.id.slice(-8).toUpperCase()} | {formatMXTime(new Date())}</Text>
        </View>

      </Page>
    </Document>
  );
};