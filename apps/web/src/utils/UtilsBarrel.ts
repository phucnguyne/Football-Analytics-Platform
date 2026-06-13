export { cn, formatDate, formatTime, formatRelativeDate } from '@/lib/utils'

export function formatGD(gd: number): string {
  return gd > 0 ? `+${gd}` : String(gd)
}

export function isMatchLive(status: string): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED'
}

export function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? str.slice(0, maxLength - 1) + '…' : str
}