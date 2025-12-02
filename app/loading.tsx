import { Skeleton } from "@/components/ui/skeleton"

// Si no tienes el componente Skeleton de shadcn instalado, este es un reemplazo rápido con Tailwind:
function SkeletonBox({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
}

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* 1. Skeleton del Navbar */}
      <div className="bg-white border-b border-slate-200 h-20 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SkeletonBox className="h-12 w-12 rounded-lg" /> {/* Logo */}
          <div className="space-y-2">
            <SkeletonBox className="h-5 w-32" />
            <SkeletonBox className="h-3 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-right hidden lg:block">
              <SkeletonBox className="h-4 w-32 mb-1" />
              <SkeletonBox className="h-3 w-20 ml-auto" />
           </div>
           <SkeletonBox className="h-10 w-10 rounded-full" /> {/* Avatar */}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* 2. Skeleton de las Tarjetas Superiores (Métricas) */}
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-8">
           {[1, 2, 3].map((i) => (
             <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-32 flex flex-col justify-between">
                <div className="flex justify-between">
                   <SkeletonBox className="h-4 w-24" />
                   <SkeletonBox className="h-8 w-8 rounded-full" />
                </div>
                <SkeletonBox className="h-8 w-16" />
                <SkeletonBox className="h-3 w-32" />
             </div>
           ))}
        </div>

        {/* 3. Skeleton del Contenido Principal (2 Columnas) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           
           {/* Columna Izquierda (Formularios) */}
           <div className="lg:col-span-8">
              <div className="bg-white rounded-xl border border-slate-200 h-[500px] p-6">
                 <SkeletonBox className="h-8 w-48 mb-6" /> {/* Título Tab */}
                 <div className="grid grid-cols-2 gap-4 mb-6">
                    <SkeletonBox className="h-10 w-full" />
                    <SkeletonBox className="h-10 w-full" />
                 </div>
                 <div className="space-y-4">
                    <SkeletonBox className="h-10 w-full" />
                    <SkeletonBox className="h-10 w-full" />
                    <SkeletonBox className="h-24 w-full" />
                    <SkeletonBox className="h-12 w-full mt-4" />
                 </div>
              </div>
           </div>

           {/* Columna Derecha (Historial) */}
           <div className="lg:col-span-4">
              <div className="bg-white rounded-xl border border-slate-200 h-[400px] p-4">
                 <div className="flex items-center gap-2 mb-4 border-b pb-2">
                    <SkeletonBox className="h-5 w-5" />
                    <SkeletonBox className="h-5 w-32" />
                 </div>
                 <div className="space-y-3">
                    {[1, 2, 3, 4].map((k) => (
                       <div key={k} className="flex justify-between items-center">
                          <div className="space-y-1">
                             <SkeletonBox className="h-3 w-20" />
                             <SkeletonBox className="h-2 w-12" />
                          </div>
                          <SkeletonBox className="h-5 w-16 rounded-full" />
                       </div>
                    ))}
                 </div>
              </div>
           </div>

        </div>
      </div>
    </div>
  )
}