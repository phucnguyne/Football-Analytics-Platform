'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

type ErrorBoundaryProps = {
  error: Error & { digest?: string }
  reset: () => void
}

/** Catches errors from pages and nested route segments. */
export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  const t = useTranslations('Common')
  useEffect(() => {
    console.error('Unhandled route error:', error)
  }, [error])

  return (
    <section className="container mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">{t('errorTitle')}</h1>
      <p className="text-muted-foreground">
        {t('pageError')}
      </p>
      <button
        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
        onClick={reset}
        type="button"
      >
        {t('retry')}
      </button>
    </section>
  )
}
