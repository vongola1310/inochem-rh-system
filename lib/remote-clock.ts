import { todayInMexico, parseDate } from './attendance/dates'

export function remoteClockTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const part = (name: string) => Number(parts.find(p => p.type === name)?.value)
  return { date: parseDate(todayInMexico(now)), seconds: part('hour') * 3600 + part('minute') * 60 + part('second'), recordedAt: now }
}

export const remotePunchSelect = { id: true, kind: true, date: true, seconds: true, recordedAt: true } as const

export function validateClockPhoto(photo: Buffer) {
  if (photo.length < 100 || photo.length > 500_000 || photo[0] !== 0xff || photo[1] !== 0xd8 || photo[photo.length - 2] !== 0xff || photo[photo.length - 1] !== 0xd9) throw new Error('Toma una foto JPEG con la cámara (máximo 500 KB).')
  // Parse dimensions before accepting the image; never trust the browser MIME type.
  const { imageSize } = require('next/dist/compiled/image-size') as { imageSize: (input: Buffer) => { width: number; height: number; type: string } }
  const image = imageSize(photo)
  if (image.type !== 'jpg' || image.width < 160 || image.height < 120 || image.width > 1280 || image.height > 1280) throw new Error('La fotografía no tiene dimensiones válidas. Vuelve a tomarla.')
}
