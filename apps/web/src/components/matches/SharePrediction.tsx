'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { predictionChoices, predictionLabels, type PredictionChoice } from '@/lib/dashboard'

export function SharePrediction({ matchId, prediction }: { matchId: number; prediction: PredictionChoice }) {
  const t = useTranslations('Social')
  const [result, setResult] = useState<{ url: string; copied: boolean } | null>(null)
  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" type="button" onClick={async () => {
        const url = new URL(`/matches/${matchId}`, window.location.origin)
        url.searchParams.set('prediction', prediction)
        try {
          await navigator.clipboard.writeText(url.href)
          setResult({ url: url.href, copied: true })
        } catch {
          setResult({ url: url.href, copied: false })
        }
      }}>{t('share')}</Button>
      {result?.copied && <p role="status" className="text-xs text-muted-foreground">{t('copied')}</p>}
      {result && !result.copied && <input readOnly value={result.url} onFocus={(event) => event.target.select()}
        aria-label={t('shareLink')} className="w-full rounded-md border bg-background p-2 text-xs" />}
    </div>
  )
}

export function SharedPrediction() {
  const params = useSearchParams()
  const social = useTranslations('Social')
  const t = useTranslations('Dashboard')
  const value = predictionChoices.find((choice) => choice === params.get('prediction'))
  return value ? (
    <p className="mb-6 rounded-xl border bg-muted/35 px-4 py-3 text-sm">
      {social('sharedChoice', { choice: t(predictionLabels[value]) })}
    </p>
  ) : null
}
