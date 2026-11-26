'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Clock, LogIn, LogOut } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { getRemoteClockStatus, recordRemotePunch } from '@/app/actions/remote-clock'
import { displayDate, displayTime } from '@/lib/attendance/dates'

type Status = Awaited<ReturnType<typeof getRemoteClockStatus>>
export function RemoteClock() {
  const [open, setOpen] = useState(false), [status, setStatus] = useState<Status | null>(null)
  const [kind, setKind] = useState<'ENTRY' | 'EXIT' | null>(null), [photo, setPhoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState(''), [message, setMessage] = useState(''), [cameraError, setCameraError] = useState('')
  const [ready, setReady] = useState(false), [loading, setLoading] = useState(false), [sending, setSending] = useState(false)
  const video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null), lock = useRef(false)
  function stopCamera() { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setReady(false) }
  async function refresh() { setLoading(true); try { setStatus(await getRemoteClockStatus()) } catch { setStatus(null); setMessage('No pudimos consultar tus checadas. Verifica tu sesión y vuelve a intentar.') } finally { setLoading(false) } }
  function changeOpen(next: boolean) { if (lock.current) return; setOpen(next); setKind(null); setPhoto(null); setMessage(''); setCameraError(''); if (next) void refresh(); else stopCamera() }
  useEffect(() => {
    if (!photo) { setPreview(''); return }
    const url = URL.createObjectURL(photo); setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])
  useEffect(() => {
    if (!open || !kind || photo) return
    let cancelled = false
    setCameraError(''); setReady(false)
    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setCameraError('La cámara requiere abrir el portal con HTTPS y un navegador compatible.'); return }
      try {
        const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 540 } }, audio: false })
        if (cancelled) { camera.getTracks().forEach(track => track.stop()); return }
        stream.current = camera
        if (video.current) { video.current.srcObject = camera; await video.current.play() }
      } catch { if (!cancelled) setCameraError('No se pudo abrir la cámara. Permite su uso en el navegador y verifica que otra aplicación no la esté utilizando.') }
    }
    void start()
    const hide = () => { if (document.hidden && !lock.current) { setKind(null); setPhoto(null) } }
    document.addEventListener('visibilitychange', hide)
    return () => { cancelled = true; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; document.removeEventListener('visibilitychange', hide) }
  }, [open, kind, photo])
  async function capture() {
    const source = video.current
    if (!source?.videoWidth || !source.videoHeight) return
    const canvas = document.createElement('canvas'), scale = Math.min(1, 720 / Math.max(source.videoWidth, source.videoHeight))
    canvas.width = Math.round(source.videoWidth * scale); canvas.height = Math.round(source.videoHeight * scale)
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    if (!blob || blob.size > 500_000) { setCameraError('No se pudo preparar la foto. Intenta de nuevo.'); return }
    setPhoto(blob); stopCamera()
  }
  async function save() {
    if (!photo || !status || !kind || lock.current) return
    lock.current = true; setSending(true); setMessage('')
    try {
      const data = new FormData(); data.set('photo', photo, 'checada.jpg'); data.set('kind', kind); data.set('date', status.date)
      const result = await recordRemotePunch(data); setMessage(result.message)
      if (result.success) { setKind(null); setPhoto(null) }
      await refresh()
    } catch { setMessage('No pudimos confirmar el envío. Consulta tus registros antes de reintentar.'); await refresh() }
    finally { lock.current = false; setSending(false) }
  }
  const entry = status?.punches.find(p => p.kind === 'ENTRY'), exit = status?.punches.find(p => p.kind === 'EXIT')
  return <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-green-200 bg-green-50 p-5">
    <div><h2 className="flex items-center gap-2 text-lg font-semibold text-green-950"><Clock className="h-5 w-5" />Checador remoto</h2><p className="mt-1 text-sm text-green-900">Registra tu entrada y salida con una fotografía.</p></div>
    <Button type="button" onClick={() => changeOpen(true)} className="min-h-11 bg-[#3e712c] text-white hover:bg-[#315a23]">Abrir checador</Button>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="w-[calc(100vw_-_24px)] max-w-lg max-h-[92dvh] overflow-y-auto rounded-2xl p-4 sm:p-6" onEscapeKeyDown={event => { if (sending) event.preventDefault() }} onInteractOutside={event => { if (sending) event.preventDefault() }}>
        <DialogHeader><DialogTitle>Checador remoto</DialogTitle><DialogDescription>Entrada y salida con foto · Hora de Ciudad de México. La hora oficial se guarda al confirmar el registro.</DialogDescription></DialogHeader>
        {status && <div className="space-y-3"><p className="text-sm font-semibold">Hoy: {displayDate(status.date)}</p><div className="grid grid-cols-2 gap-3">{[['Entrada', entry], ['Salida', exit]].map(([label, punch]) => { const row = punch as Status['punches'][number] | undefined; return <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{String(label)}</p><p className="mt-1 font-semibold">{row ? displayTime(row.seconds) : 'Sin registro'}</p>{row && <a className="mt-2 inline-block text-xs font-medium text-green-800 underline" href={`/api/remote-clock/${row.id}/photo`} target="_blank" rel="noreferrer">Ver foto</a>}</div> })}</div></div>}
        {loading && <p role="status" className="text-sm text-slate-500">Consultando registros…</p>}
        {!kind && <div className="grid gap-3 sm:grid-cols-2"><Button type="button" disabled={!status || loading || !!entry || !!exit} onClick={() => { setKind('ENTRY'); setMessage('') }} className="min-h-12 bg-[#3e712c] text-white hover:bg-[#315a23]"><LogIn className="mr-2 h-4 w-4" />Checar entrada</Button><Button type="button" variant="outline" disabled={!status || loading || !!exit} onClick={() => { setKind('EXIT'); setMessage('') }} className="min-h-12"><LogOut className="mr-2 h-4 w-4" />Checar salida</Button></div>}
        {kind && <div className="space-y-3"><p className="font-medium">{kind === 'ENTRY' ? 'Foto de entrada' : 'Foto de salida'}</p>{kind === 'EXIT' && !entry && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No registraste entrada hoy. Tu salida se conservará y la entrada faltante se revisará como incidencia.</p>}
          <div className="overflow-hidden rounded-xl bg-slate-900">{photo ? <img src={preview} alt="Fotografía para la checada" className="max-h-[35dvh] w-full object-contain" /> : <video ref={video} autoPlay muted playsInline onLoadedData={() => setReady(true)} className="max-h-[35dvh] min-h-36 w-full object-contain" />}</div>
          {cameraError && <p role="alert" className="text-sm text-red-700">{cameraError}</p>}
          {!photo && !ready && !cameraError && <p role="status" className="text-sm text-slate-600">Activando cámara… Autoriza su uso si el navegador te lo solicita.</p>}
          <div className="grid gap-2 sm:grid-cols-2">{photo ? <><Button type="button" variant="outline" disabled={sending} onClick={() => setPhoto(null)}>Repetir foto</Button><Button type="button" disabled={sending || loading} onClick={save} className="min-h-11 bg-[#3e712c] text-white hover:bg-[#315a23]">{sending ? 'Registrando…' : `Confirmar ${kind === 'ENTRY' ? 'entrada' : 'salida'}`}</Button></> : <Button type="button" disabled={!ready} onClick={capture} className="min-h-11 bg-[#3e712c] text-white hover:bg-[#315a23]"><Camera className="mr-2 h-4 w-4" />Tomar foto</Button>}<Button type="button" variant="ghost" disabled={sending} onClick={() => { setKind(null); setPhoto(null); stopCamera() }}>Volver</Button></div>
        </div>}
        {message && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
        {!kind && <Button type="button" variant="ghost" disabled={loading || sending} onClick={refresh}>Actualizar registros</Button>}
        <p className="text-xs leading-relaxed text-slate-500">La foto se utiliza como evidencia de asistencia. Cada día se conserva una entrada y una salida. Si cierras sin confirmar, no se registra la checada.</p>
      </DialogContent>
    </Dialog>
  </section>
}
