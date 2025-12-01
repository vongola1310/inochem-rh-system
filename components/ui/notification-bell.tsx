// components/ui/notification-bell.tsx
'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getUnreadNotifications, markNotificationAsRead } from '@/app/actions/notifications'
import { useRouter } from 'next/navigation'

type Notification = {
  id: string
  title: string
  message: string
  link: string | null
  createdAt: Date
}

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const router = useRouter()

  const fetchNotifications = async () => {
    const res = await getUnreadNotifications(userId)
    if (res.success) {
      setNotifications(res.data)
    }
  }

  useEffect(() => {
    fetchNotifications() // Carga inicial
    // Polling: Revisar cada 10 segundos
    const interval = setInterval(fetchNotifications, 10000)
    return () => clearInterval(interval)
  }, [userId])

  const handleClick = async (notif: Notification) => {
    await markNotificationAsRead(notif.id)
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id))
    if (notif.link) router.push(notif.link)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] rounded-full">
              {notifications.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">Sin novedades</div>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem key={n.id} onClick={() => handleClick(n)} className="cursor-pointer flex flex-col items-start p-3">
              <span className="font-bold text-sm">{n.title}</span>
              <span className="text-xs text-muted-foreground">{n.message}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}