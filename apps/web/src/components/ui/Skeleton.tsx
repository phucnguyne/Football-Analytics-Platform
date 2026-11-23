import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('rounded-md bg-muted motion-safe:animate-pulse', className)} />
}

function LoadingRegion({ children, className }: { children: ReactNode; className?: string }) {
  const t = useTranslations('Common')
  return (
    <div role="status" className={className}>
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  )
}

export function ChartSkeleton({ className }: { className?: string }) {
  return <LoadingRegion><Skeleton className={cn('h-72 rounded-2xl border', className)} /></LoadingRegion>
}

export function CardGridSkeleton() {
  return (
    <LoadingRegion>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-xl border bg-card p-5">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}

export function PageSkeleton({ variant = 'cards' }: { variant?: 'cards' | 'table' | 'detail' | 'login' }) {
  if (variant === 'login') {
    return <LoadingRegion className="mx-auto max-w-md px-4 py-16"><Skeleton className="h-80 w-full rounded-2xl" /></LoadingRegion>
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <Skeleton className="h-9 w-56 max-w-full" />
      {variant === 'cards' && <CardGridSkeleton />}
      {variant === 'detail' && (
        <LoadingRegion>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-xl" />
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl md:col-span-2" />
            </div>
          </div>
        </LoadingRegion>
      )}
      {variant === 'table' && (
        <LoadingRegion>
          <div className="divide-y rounded-xl border bg-card">
            {Array.from({ length: 10 }, (_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="size-6" />
                <Skeleton className="mr-auto h-4 w-1/4" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
        </LoadingRegion>
      )}
    </div>
  )
}
