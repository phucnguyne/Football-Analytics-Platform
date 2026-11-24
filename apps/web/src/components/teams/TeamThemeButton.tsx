'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { pickTeamAccent, teamAccents } from '@/lib/team-theme'
import { useTheme } from '@/providers/ThemeProvider'

export function TeamThemeButton({ name, colors }: { name: string; colors?: string | null }) {
  const t = useTranslations('Appearance')
  const { teamTheme, setTeamTheme, resolvedTheme } = useTheme()
  const accent = pickTeamAccent(colors)
  if (!accent) return null

  const active = teamTheme?.name === name && teamTheme.accent === accent
  return (
    <Button type="button" variant="outline" aria-pressed={active} onClick={() => setTeamTheme(active ? null : { name, accent })}>
      <span className="size-3 rounded-full border" style={{ backgroundColor: teamAccents[accent][resolvedTheme] }} aria-hidden="true" />
      {t('useClub')}
    </Button>
  )
}
