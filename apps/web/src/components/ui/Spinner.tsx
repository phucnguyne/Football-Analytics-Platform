import { cn } from "@/lib/utils"

export function PageSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-center items-center p-8", className)}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
}
