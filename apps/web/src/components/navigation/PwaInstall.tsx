'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

type InstallEvent = Event & { prompt(): Promise<unknown> }

export function PwaInstall() {
  const t = useTranslations('Navigation')
  const [install, setInstall] = useState<InstallEvent | null>(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    function onPrompt(event: Event) {
      event.preventDefault()
      setInstall(event as InstallEvent)
    }
    function onInstalled() {
      setInstall(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    void navigator.serviceWorker.register('/sw.js').catch((error) => console.error('App registration failed', error))
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!install) return null
  return (
    <Button variant="ghost" size="icon" aria-label={t('install')} onClick={() => {
      setInstall(null)
      void install.prompt().catch(() => undefined)
    }}>
      <Download className="size-5" aria-hidden="true" />
    </Button>
  )
}
