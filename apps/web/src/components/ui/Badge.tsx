import type messages from '../../../messages/en.json'
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"

export function StatusBadge({ status, className }: { status: string, className?: string }) {
  const t = useTranslations('Status')
  const key = status as keyof typeof messages.Status
  const isLive = status === 'IN_PLAY' || status === 'PAUSED'
  return (
    <span className={cn(
      "px-2 py-1 text-[10px] font-bold tracking-wider rounded-md uppercase",
      isLive ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted text-muted-foreground",
      className
    )}>
      {t.has(key) ? t(key) : status.replaceAll('_', ' ')}
    </span>
  )
}
