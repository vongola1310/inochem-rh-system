'use client'

import { Button } from '@/components/ui/button'
import { FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'

export function DownloadExcel({ data, fileName }: { data: any[], fileName: string }) {
  
  const handleDownload = () => {
    // 1. Aplanar y formatear datos para que se vean bien en Excel
    // Si no hacemos esto, las fechas salen como números raros o ISO strings feos
    const formattedData = data.map(item => {
        const newItem: any = {};
        for (const key in item) {
            // Si es fecha, la formateamos bonito
            if (item[key] instanceof Date || (typeof item[key] === 'string' && item[key].includes('T') && !isNaN(Date.parse(item[key])))) {
                 try {
                    newItem[key] = format(new Date(item[key]), 'dd/MM/yyyy');
                 } catch (e) {
                    newItem[key] = item[key];
                 }
            } else {
                newItem[key] = item[key];
            }
        }
        return newItem;
    });

    // 2. Crear hoja de trabajo
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    
    // Ajustar ancho de columnas automáticamente (opcional, mejora la vista)
    const wscols = Object.keys(formattedData[0] || {}).map(() => ({ wch: 20 }));
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Inochem");
    
    // 3. Generar archivo con fecha actual en el nombre
    XLSX.writeFile(workbook, `${fileName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  }

  return (
    <Button 
        onClick={handleDownload} 
        variant="outline" 
        className="gap-2 text-green-700 border-green-200 hover:bg-green-50 hover:border-green-300 transition-all shadow-sm"
        disabled={!data || data.length === 0}
    >
      <FileSpreadsheet className="h-4 w-4" />
      Exportar Excel
    </Button>
  )
}