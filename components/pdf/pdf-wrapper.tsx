'use client'

import { PDFDownloadLink } from '@react-pdf/renderer'
import { RequestDocument } from './request-document'
import { Button } from '@/components/ui/button'
import { FileDown, Loader2 } from 'lucide-react'

// Este componente solo se renderizará en el cliente gracias al dynamic import del padre
export default function PDFWrapper({ data, fileName }: { data: any, fileName: string }) {
  return (
    <PDFDownloadLink document={<RequestDocument data={data} />} fileName={fileName}>
      {/* @ts-ignore - ReactPDF types issue workaround */}
      {({ loading }) => (
        <Button 
          variant="outline" 
          className="border-slate-300 hover:bg-slate-50 text-slate-700 gap-2" 
          // Deshabilitamos mientras se genera el blob interno del PDF
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin"/>
          ) : (
            <FileDown className="w-4 h-4"/>
          )}
          {loading ? 'Generando...' : 'Descargar PDF Oficial'}
        </Button>
      )}
    </PDFDownloadLink>
  )
}