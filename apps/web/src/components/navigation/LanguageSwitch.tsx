'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { localeCookie } from '@/i18n/locales'
import { Button } from '@/components/ui/button'

export function LanguageSwitch() {
  const t = useTranslations('Navigation')
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const next = locale === 'en' ? 'vi' : 'en'

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('language')}
      disabled={pending}
      onClick={() => {
        const secure = window.location.protocol === 'https:' ? '; Secure' : ''
        document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
        startTransition(() => router.refresh())
      }}
    >
      <span lang={next}>{next.toUpperCase()}</span>
    </Button>
  )
}
