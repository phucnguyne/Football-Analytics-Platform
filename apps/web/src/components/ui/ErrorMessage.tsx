import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function ErrorMessage({ message, className, onRetry }: { message?: string, className?: string, onRetry?: () => void }) {
  const t = useTranslations('Common')
  return (
    <div className={cn("text-destructive bg-destructive/10 p-4 rounded-md font-medium flex items-center justify-between", className)}>
      <span>{message ?? t('error')}</span>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="ml-4">
          {t('retry')}
        </Button>
      )}
    </div>
  )
}
