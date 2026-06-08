'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { XCircle, ChevronDown, Send } from 'lucide-react'
import { processRequest } from '@/app/actions/manage-request'

interface RejectFormProps {
  requestId: string
}

export function RejectForm({ requestId }: RejectFormProps) {
  const [showReason, setShowReason] = useState(false)
  const [reason, setReason] = useState('')

  if (!showReason) {
    return (
      <Button 
        variant="outline" 
        className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 h-12 rounded-xl font-medium"
        onClick={() => setShowReason(true)}
      >
        Rechazar Solicitud
      </Button>
    )
  }

  return (
    <div className="w-full space-y-3 animate-in slide-in-from-top-2 duration-300">
      <div className="bg-red-50 rounded-xl border border-red-200 p-4">
        <label className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 block">
          Motivo del rechazo
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Escribe el motivo por el cual se rechaza esta solicitud..."
          className="w-full min-h-[80px] p-3 rounded-lg border border-red-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-300 resize-y"
          autoFocus
        />
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          className="flex-1 text-slate-500 hover:text-slate-700 h-10 rounded-xl text-sm"
          onClick={() => { setShowReason(false); setReason('') }}
        >
          Cancelar
        </Button>
        <form action={processRequest} className="flex-1">
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="action" value="REJECT" />
          <input type="hidden" name="reason" value={reason} />
          <Button 
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white h-10 rounded-xl font-medium text-sm gap-1.5"
            disabled={!reason.trim()}
          >
            <XCircle className="h-4 w-4" />
            Confirmar Rechazo
          </Button>
        </form>
      </div>
    </div>
  )
}
