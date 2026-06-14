import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function ErrorMessage({ message = "An error occurred", className, onRetry }: { message?: string, className?: string, onRetry?: () => void }) {
  return (
    <div className={cn("text-destructive bg-destructive/10 p-4 rounded-md font-medium flex items-center justify-between", className)}>
      <span>{message}</span>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="ml-4">
          Retry
        </Button>
      )}
    </div>
  )
}
