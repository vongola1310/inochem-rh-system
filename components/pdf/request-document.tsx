/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ESTILOS DE ALTA PRECISIÓN
const styles = StyleSheet.create({
  page: { 
    paddingTop: 30,
    paddingBottom: 30,
    paddingLeft: 40,
    paddingRight: 40,
    fontSize: 9, 
    fontFamily: 'Helvetica',
    color: '#000'
  },
  
  // === NUEVO HEADER EXACTO (TABLA 3 COLUMNAS) ===
  headerTable: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 20,
    height: 50 // Altura fija para controlar proporciones
  },
  
  // Columna 1: Logo y Vigencia
  col1: {
    width: '25%',
    borderRightWidth: 1,
    borderColor: '#000',
    flexDirection: 'column'
  },
  logoContainer: {
    height: '65%', // El logo ocupa la parte superior
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#000'
  },
  vigenciaContainer: {
    height: '35%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  },

  // Columna 2: Proceso, Título, Revisión
  col2: {
    width: '50%',
    borderRightWidth: 1,
    borderColor: '#000',
    flexDirection: 'column'
  },
  rowProceso: {
    height: '25%',
    borderBottomWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center'
  },
  rowTitulo: {
    height: '50%', // Título más grande
    borderBottomWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center'
  },
  rowRevision: {
    height: '25%',
    justifyContent: 'center',
    alignItems: 'center'
  },

  // Columna 3: Código, Página, Versión
  col3: {
    width: '25%',
    flexDirection: 'column'
  },
  rowCodigo: {
    height: '33.33%',
    borderBottomWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
    paddingLeft: 5
  },
  rowPagina: {
    height: '33.33%',
    borderBottomWidth: 1,
    borderColor: '#000',
    justifyContent: 'center',
    paddingLeft: 5
  },
  rowVersion: {
    height: '33.33%',
    justifyContent: 'center',
    paddingLeft: 5
  },

  // Textos del Header
  headerLabel: { fontSize: 6, color: '#444' },
  headerValue: { fontSize: 7, fontWeight: 'bold' },
  headerTitleText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },


  // === RESTO DEL DOCUMENTO (Igual que antes) ===
  sectionTitle: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 15, marginTop: 10, textTransform: 'uppercase' },
  
  fieldGroup: { marginBottom: 10 },
  label: { fontSize: 8, fontWeight: 'bold', marginBottom: 2 },
  
  inputBox: { 
    borderWidth: 1, 
    borderColor: '#000', 
    backgroundColor: '#eaf4fc',
    padding: 4, 
    minHeight: 18,
    justifyContent: 'center'
  },
  inputText: { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  // Grid de Fechas
  dateBoxContainer: { width: '30%' },
  
  // Firmas
  signatureTable: { 
    marginTop: 40, 
    borderWidth: 1, 
    borderColor: '#000',
    flexDirection: 'row'
  },
  signatureCol: { 
    width: '33.33%', 
    borderRightWidth: 1, 
    borderColor: '#000',
    height: 60,
    justifyContent: 'space-between'
  },
  signatureHeader: { 
    backgroundColor: '#dbebf7',
    padding: 4, 
    textAlign: 'center', 
    fontSize: 6, 
    fontWeight: 'bold',
    borderBottomWidth: 1,
    borderColor: '#000'
  },
  signatureArea: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1
  },
  digitalStamp: {
    fontSize: 5,
    color: 'blue',
    textAlign: 'center',
    marginBottom: 1
  },

  // Checkboxes
  checkboxRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 4 },
  checkboxItem: { flexDirection: 'row', alignItems: 'center' },
  box: { width: 8, height: 8, borderWidth: 1, borderColor: '#000', marginRight: 3, justifyContent: 'center', alignItems: 'center', fontSize: 7 },

  footer: { position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 6, color: '#999' }
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
        
        {/* ==================== HEADER EXACTO ==================== */}
        <View style={styles.headerTable}>
            
            {/* COLUMNA 1: Logo y Vigencia */}
            <View style={styles.col1}>
                <View style={styles.logoContainer}>
                    {/* AQUÍ ESTÁ EL CAMBIO DEL LOGO */}
                    <Image src="/logo-inochem.png" style={{ width: 70, height: 'auto' }} />
                </View>
                <View style={styles.vigenciaContainer}>
                    <Text style={{ fontSize: 5 }}>Vigente a partir de: OCT-2024</Text>
                </View>
            </View>

            {/* COLUMNA 2: Proceso y Título */}
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

            {/* COLUMNA 3: Datos de Control */}
            <View style={styles.col3}>
                <View style={styles.rowCodigo}>
                    <Text style={styles.headerLabel}>Código: <Text style={styles.headerValue}>{docCode}</Text></Text>
                </View>
                <View style={styles.rowPagina}>
                    <Text style={styles.headerLabel}>Página: <Text style={styles.headerValue}>1 de 1</Text></Text>
                </View>
                <View style={styles.rowVersion}>
                    <Text style={{ fontSize: 5, color: '#444' }}>Versión: Nuevo</Text>
                    <Text style={{ fontSize: 5, color: '#444' }}>Sustituye a: N/A</Text>
                </View>
            </View>
        </View>

        {/* TITULO GRANDE */}
        <Text style={styles.sectionTitle}>{docTitle}</Text>

        {/* FECHA DE ELABORACIÓN (Alineada a la derecha como en el formato) */}
        <View style={{ alignItems: 'flex-end', marginBottom: 15 }}>
            <View style={{ width: 100 }}>
                <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#000' }}>
                    <View style={{ flex: 1, borderRightWidth: 1, padding: 2, alignItems: 'center' }}>
                        <Text style={styles.inputText}>{format(new Date(data.createdAt), 'dd')}</Text>
                    </View>
                    <View style={{ flex: 1, borderRightWidth: 1, padding: 2, alignItems: 'center' }}>
                        <Text style={styles.inputText}>{format(new Date(data.createdAt), 'MM')}</Text>
                    </View>
                    <View style={{ flex: 1.5, padding: 2, alignItems: 'center' }}>
                        <Text style={styles.inputText}>{format(new Date(data.createdAt), 'yyyy')}</Text>
                    </View>
                </View>
                <Text style={{ fontSize: 7, textAlign: 'center', marginTop: 2 }}>Fecha de elaboración</Text>
            </View>
        </View>

        {/* NOMBRE DEL EMPLEADO */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <Text style={{ ...styles.label, width: 100 }}>Nombre del empleado:</Text>
            <View style={{ ...styles.inputBox, flex: 1 }}>
                <Text style={styles.inputText}>{data.user.name}</Text>
            </View>
        </View>

        {/* CUERPO DEL FORMATO (Vacaciones o Permisos) */}
        {isVacation ? (
            <View style={{ marginTop: 5 }}>
                {/* Fila de Bloques: Inicio, Días, Reanudo */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    
                    {/* INICIO */}
                    <View style={styles.dateBoxContainer}>
                        <View style={{ borderWidth: 1, borderColor: '#000', marginBottom: 2 }}>
                           <View style={{ flexDirection: 'row', backgroundColor: '#eaf4fc' }}>
                              <View style={{ flex: 1, padding: 3, alignItems: 'center', borderRightWidth: 1 }}><Text style={styles.inputText}>{format(new Date(data.startDate), 'dd')}</Text></View>
                              <View style={{ flex: 1, padding: 3, alignItems: 'center', borderRightWidth: 1 }}><Text style={styles.inputText}>{format(new Date(data.startDate), 'MM')}</Text></View>
                              <View style={{ flex: 1.5, padding: 3, alignItems: 'center' }}><Text style={styles.inputText}>{format(new Date(data.startDate), 'yyyy')}</Text></View>
                           </View>
                        </View>
                        <Text style={{ fontSize: 7, textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e0e0e0' }}>Inicio de Vacaciones</Text>
                    </View>

                    {/* DÍAS - Centrado verticalmente para parecerse a la imagen */}
                    <View style={{ width: '20%', justifyContent: 'center', alignItems: 'center', paddingTop: 10 }}>
                         <View style={{ borderWidth: 1, width: '100%', padding: 3, alignItems: 'center', marginBottom: 2, backgroundColor: '#eaf4fc' }}>
                            <Text style={styles.inputText}>{data.daysRequested}</Text>
                         </View>
                         <Text style={{ fontSize: 7, textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e0e0e0', width: '100%' }}>Número de días</Text>
                    </View>

                    {/* REANUDO */}
                    <View style={styles.dateBoxContainer}>
                         <View style={{ borderWidth: 1, borderColor: '#000', marginBottom: 2 }}>
                           <View style={{ flexDirection: 'row', backgroundColor: '#eaf4fc' }}>
                              <View style={{ flex: 1, padding: 3, alignItems: 'center', borderRightWidth: 1 }}><Text style={styles.inputText}>{data.returnDate ? format(new Date(data.returnDate), 'dd') : '-'}</Text></View>
                              <View style={{ flex: 1, padding: 3, alignItems: 'center', borderRightWidth: 1 }}><Text style={styles.inputText}>{data.returnDate ? format(new Date(data.returnDate), 'MM') : '-'}</Text></View>
                              <View style={{ flex: 1.5, padding: 3, alignItems: 'center' }}><Text style={styles.inputText}>{data.returnDate ? format(new Date(data.returnDate), 'yyyy') : '-'}</Text></View>
                           </View>
                        </View>
                        <Text style={{ fontSize: 7, textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e0e0e0' }}>Reanudo labores</Text>
                    </View>
                </View>
            </View>
        ) : (
            <View style={{ marginTop: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                    <Text style={{ ...styles.label, width: 100 }}>Indique tipo de permiso:</Text>
                    <View style={{ flex: 1, flexDirection: 'row', gap: 15 }}>
                         <Text style={styles.headerValue}>{data.type === 'PERMIT_LATE' ? '[X]' : '[ ]'} Llegar tarde</Text>
                         <Text style={styles.headerValue}>{data.type === 'PERMIT_EARLY' ? '[X]' : '[ ]'} Salir temprano</Text>
                         <Text style={styles.headerValue}>{data.type === 'PERMIT_ABSENCE' ? '[X]' : '[ ]'} Faltar</Text>
                         <Text style={styles.headerValue}>{data.type === 'PERMIT_BIRTHDAY' ? '[X]' : '[ ]'} Cumpleaños</Text>
                         <Text style={styles.headerValue}>{data.type === 'PERMIT_OTHER' ? '[X]' : '[ ]'} Otro</Text>
                    </View>
                </View>
                
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                    <View style={{ width: '40%' }}>
                         <View style={styles.inputBox}><Text style={styles.inputText}>{format(new Date(data.startDate), 'dd/MM/yyyy')}</Text></View>
                         <Text style={{ fontSize: 7, textAlign: 'center', fontWeight: 'bold' }}>Fecha de permiso</Text>
                    </View>
                    <View style={{ width: '20%' }}></View>
                    <View style={{ width: '40%' }}>
                         <View style={styles.inputBox}><Text style={styles.inputText}>{data.permitTime || 'N/A'}</Text></View>
                         <Text style={{ fontSize: 7, textAlign: 'center', fontWeight: 'bold' }}>Horario (si aplica)</Text>
                    </View>
                </View>
            </View>
        )}

        {/* OBSERVACIONES */}
        <View style={{ marginTop: 20, flexDirection: 'row' }}>
            <Text style={{ ...styles.label, width: 80, textDecoration: 'underline' }}>Observaciones:</Text>
            <View style={{ ...styles.inputBox, flex: 1, minHeight: 40, backgroundColor: '#f0f8ff' }}>
                <Text style={styles.inputText}>{data.observations}</Text>
            </View>
        </View>

        {/* FIRMAS */}
        <View style={styles.signatureTable}>
            <View style={styles.signatureCol}>
                <View style={styles.signatureHeader}><Text>Nombre y firma SOLICITANTE</Text></View>
                <View style={styles.signatureArea}>
                    <Text style={styles.digitalStamp}>Firma Digital: {data.user.employeeNumber}</Text>
                    <Text style={{ fontSize: 8, fontWeight: 'bold' }}>{data.user.name}</Text>
                </View>
            </View>

            <View style={styles.signatureCol}>
                <View style={styles.signatureHeader}><Text>Nombre y firma Jefe Inmediato AUTORIZA</Text></View>
                <View style={styles.signatureArea}>
                    {data.approvedByBoss ? (
                        <>
                           <Text style={{ fontSize: 7, color: 'green' }}>[ AUTORIZADO ]</Text>
                           <Text style={styles.digitalStamp}>{data.bossApprovalDate ? format(new Date(data.bossApprovalDate), 'dd/MM/yyyy HH:mm') : ''}</Text>
                        </>
                    ) : null}
                </View>
            </View>

            <View style={{ ...styles.signatureCol, borderRightWidth: 0 }}>
                <View style={styles.signatureHeader}><Text>Nombre y firma RECURSOS HUMANOS</Text></View>
                <View style={styles.signatureArea}>
                    {data.approvedByHR ? (
                        <>
                           <Text style={{ fontSize: 7, color: 'green' }}>[ VALIDADO ]</Text>
                           <Text style={styles.digitalStamp}>{data.hrApprovalDate ? format(new Date(data.hrApprovalDate), 'dd/MM/yyyy HH:mm') : ''}</Text>
                        </>
                    ) : null}
                </View>
            </View>
        </View>

        <Text style={styles.footer}>Revvity Proprietary Information</Text>
      </Page>
    </Document>
  );
};