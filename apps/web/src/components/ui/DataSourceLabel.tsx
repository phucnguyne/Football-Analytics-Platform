import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { SourceKind } from '@/lib/data-source'

export function DataSourceLabel({ kind, detail, className }: {
  kind: SourceKind
  detail?: string
  className?: string
}) {
  const t = useTranslations('Sources')
  return (
    <span className={cn(
      'inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium leading-snug',
      kind === 'real' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      (kind === 'generated' || kind === 'mixed' || kind === 'model') &&
        'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
      kind === 'unavailable' && 'bg-muted text-muted-foreground',
      className,
    )}>
      {t(kind)}{detail && ` · ${detail}`}
    </span>
  )
}
