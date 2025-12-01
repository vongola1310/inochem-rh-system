'use client'

import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { FileDown, Loader2 } from 'lucide-react'
import { RequestDocument } from './request-document'

// CORRECCIÓN: Usamos 'as any' para evitar el conflicto de tipos de TypeScript
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink as any),
  { 
    ssr: false, 
    loading: () => (
      <Button variant="outline" disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin"/> 
        Preparando...
      </Button>
    ) 
  }
) as any

export function DownloadButton({ data }: { data: any }) {
  // Limpiamos el nombre del archivo para que no tenga espacios raros
  const safeName = data.user.name.replace(/[^a-zA-Z0-9]/g, '_')
  const fileName = `Inochem_${data.type}_${safeName}.pdf`

  return (
    <PDFDownloadLink document={<RequestDocument data={data} />} fileName={fileName}>
      {/* @ts-ignore */}
      {({ loading }) => (
        <Button variant="outline" className="border-slate-300 hover:bg-slate-50 text-slate-700">
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
          ) : (
            <FileDown className="w-4 h-4 mr-2"/>
          )}
          Descargar PDF Oficial
        </Button>
      )}
    </PDFDownloadLink>
  )
}