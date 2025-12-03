'use client'

import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

// Importamos NUESTRO componente wrapper dinámicamente.
// Esto aísla completamente @react-pdf/renderer del proceso de renderizado inicial del servidor.
// ssr: false es CRÍTICO aquí.
const PDFWrapper = dynamic(() => import('./pdf-wrapper'), {
  ssr: false, 
  loading: () => (
    <Button variant="outline" disabled className="border-slate-300 text-slate-400 gap-2">
      <Loader2 className="w-4 h-4 animate-spin"/>
      Cargando módulo PDF...
    </Button>
  )
})

export function DownloadButton({ data }: { data: any }) {
  // Preparamos el nombre del archivo limpio (sin caracteres raros)
  const safeName = data.user.name.replace(/[^a-zA-Z0-9]/g, '_')
  const fileName = `Inochem_${data.type}_${safeName}.pdf`

  return <PDFWrapper data={data} fileName={fileName} />
}