"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      expand={true}
      richColors={false}
      icons={{
        success: (
          <div className="h-8 w-8 rounded-full bg-[#73C056]/10 flex items-center justify-center shrink-0">
            <CircleCheckIcon className="h-4 w-4 text-[#73C056]" />
          </div>
        ),
        info: (
          <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
            <InfoIcon className="h-4 w-4 text-blue-600" />
          </div>
        ),
        warning: (
          <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
            <TriangleAlertIcon className="h-4 w-4 text-amber-600" />
          </div>
        ),
        error: (
          <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
            <OctagonXIcon className="h-4 w-4 text-red-600" />
          </div>
        ),
        loading: (
          <div className="h-8 w-8 rounded-full bg-slate-500/10 flex items-center justify-center shrink-0">
            <Loader2Icon className="h-4 w-4 text-slate-600 animate-spin" />
          </div>
        ),
      }}
      toastOptions={{
        classNames: {
          toast: "bg-white text-slate-900 border border-slate-200 shadow-lg rounded-xl p-4 gap-3 flex items-start w-full max-w-md backdrop-blur-sm",
          title: "text-sm font-semibold text-slate-900 leading-tight",
          description: "text-sm text-slate-600 mt-1 leading-relaxed",
          actionButton: "bg-[#73C056] text-white hover:bg-[#62a847] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm",
          cancelButton: "bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
          closeButton: "bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 rounded-lg transition-colors",
          success: "border-l-4 border-l-[#73C056]",
          error: "border-l-4 border-l-red-500",
          warning: "border-l-4 border-l-amber-500",
          info: "border-l-4 border-l-blue-500",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }