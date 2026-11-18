import { PageSpinner } from '@/components/ui/Spinner'

/** Displayed while an App Router navigation is resolving. */
export default function Loading() {
  return (
    <div className="container mx-auto flex min-h-[50vh] items-center justify-center px-4">
      <div aria-label="Loading page" role="status">
        <PageSpinner />
      </div>
    </div>
  )
}
