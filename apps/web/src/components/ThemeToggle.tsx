'use client'

import { useTranslations } from 'next-intl'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/providers/ThemeProvider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export function ThemeToggle() {
  const t = useTranslations('Appearance')
  const { theme, resolvedTheme, setTheme, teamTheme, setTeamTheme } = useTheme()
  const Icon = resolvedTheme === 'dark' ? Moon : Sun

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={t('title')}>
          <Icon className="size-5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] rounded-xl">
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription>{t('description')}</DialogDescription>
        <div className="flex flex-wrap gap-2">
          {(['system', 'light', 'dark'] as const).map((mode) => (
            <Button size="sm" key={mode} variant={theme === mode ? 'default' : 'outline'} aria-pressed={theme === mode}
              onClick={() => setTheme(mode)}>{t(mode)}</Button>
          ))}
        </div>
        {teamTheme && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <span className="text-sm font-medium">{t('selected', { team: teamTheme.name })}</span>
            <Button size="sm" variant="outline" onClick={() => setTeamTheme(null)}>{t('reset')}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
