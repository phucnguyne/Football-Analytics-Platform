'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { SharePrediction } from '@/components/matches/SharePrediction'
import { Button } from '@/components/ui/button'
import { predictionChoices, predictionLabels, type PredictionChoice } from '@/lib/dashboard'
import { loginLink } from '@/lib/login-link'

export function MatchPredictionForm({ matchId }: { matchId: number }) {
  const t = useTranslations('Dashboard')
  const common = useTranslations('Common')
  const { data: session, status } = useSession()
  const client = useQueryClient()
  const userId = session?.user?.id
  const url = `/api/predictions/matches/${matchId}`
  const queryKey = ['match-prediction', userId, matchId]
  const saved = useQuery<{ prediction: PredictionChoice | null }>({
    queryKey,
    enabled: !!userId,
    queryFn: async ({ signal }) => {
      const res = await fetch(url, { signal })
      if (!res.ok) throw new Error('load')
      return res.json()
    },
  })
  const save = useMutation({
    mutationFn: async (prediction: PredictionChoice) => {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prediction }),
      })
      if (!res.ok) throw new Error(res.status === 409 ? 'closed' : 'save')
      return res.json() as Promise<{ prediction: PredictionChoice }>
    },
    onSuccess: (result) => {
      client.setQueryData(queryKey, result)
      void client.invalidateQueries({ queryKey: ['dashboard', userId] })
    },
  })

  if (status === 'loading') return null

  return (
    <section className="mb-6 space-y-3 rounded-2xl border bg-card p-6">
      <h2 className="text-lg font-bold">{t('predictionTitle')}</h2>
      {userId ? (
        <>
          <div className="flex flex-wrap gap-2">
            {predictionChoices.map((choice) => (
              <Button key={choice} variant="outline" type="button" aria-pressed={saved.data?.prediction === choice}
                className="aria-pressed:border-primary aria-pressed:text-primary"
                disabled={saved.isPending || saved.isError || save.isPending || save.error?.message === 'closed'}
                onClick={() => save.mutate(choice)}>
                {t(predictionLabels[choice])}
              </Button>
            ))}
          </div>
          {saved.data?.prediction && <SharePrediction key={saved.data.prediction} matchId={matchId} prediction={saved.data.prediction} />}
          {saved.isError && <Button onClick={() => saved.refetch()} variant="outline">{common('retry')}</Button>}
          {save.isSuccess && <p role="status" className="text-sm text-muted-foreground">{t('saved')}</p>}
          {save.isError && <p role="alert" className="text-sm text-destructive">
            {save.error.message === 'closed' ? t('predictionClosed') : common('error')}
          </p>}
        </>
      ) : <Button asChild variant="outline"><Link href={loginLink(`/matches/${matchId}`)}>{common('signIn')}</Link></Button>}
    </section>
  )
}
