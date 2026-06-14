import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Focus ring utility
export const focusRing = cn(
  "focus-visible:outline-none focus-visible:ring-2",
  "focus-visible:ring-ring focus-visible:ring-offset-2",
);

// Disabled utility
export const disabled = "disabled:pointer-events-none disabled:opacity-50";

import { format, isToday, isTomorrow, isYesterday } from 'date-fns'

export function formatDate(dateString: string) {
  if (!dateString) return ''
  return format(new Date(dateString), 'MMM d, yyyy')
}

export function formatTime(dateString: string) {
  if (!dateString) return ''
  return format(new Date(dateString), 'HH:mm')
}

export function formatRelativeDate(dateString: string) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d')
}