import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}


export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short',
    day:     'numeric',
    month:   'short',
  })
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-GB', {
    hour:   '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeDate(dateStr: string): string {
  const now  = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((date.getTime() - now.getTime()) / 86_400_000)

  if (diff === 0)  return 'Today'
  if (diff === 1)  return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return formatDate(dateStr)
}