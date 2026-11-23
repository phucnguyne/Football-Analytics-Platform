'use client'

import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'

interface SeasonOption {
  id: number
  year: number
  isCurrent: boolean
}

interface Props {
  competition: string
  value: string
  onChange: (value: string) => void
}

export function SeasonSelector({ competition, value, onChange }: Props) {
  const t = useTranslations('Common')
  const { data, isLoading } = useQuery<{ seasons: SeasonOption[] }>({
    queryKey: ['competition-seasons', competition],
    queryFn: async () => {
      const response = await fetch(`/api/competitions/${competition}/seasons`)
      if (!response.ok) throw new Error('Failed to load seasons')
      return response.json()
    },
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-44"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={isLoading || !data?.seasons.length}
      aria-label={t('allSeasons')}
    >
      <option value="">{t('currentSeason')}</option>
      {(data?.seasons ?? []).map((season) => (
        <option key={season.id} value={season.id}>
          {season.year}/{String(season.year + 1).slice(-2)}{season.isCurrent ? ` (${t('current')})` : ''}
        </option>
      ))}
    </select>
  )
}