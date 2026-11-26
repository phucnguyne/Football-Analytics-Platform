'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { BrandLink } from './BrandLink'
import { GlobalSearch } from './GlobalSearch'
import { PwaInstall } from './PwaInstall'
import { LanguageSwitch } from './LanguageSwitch'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const links = [
  { href: '/matches', label: 'matches' },
  { href: '/live', label: 'live' },
  { href: '/standings', label: 'standings' },
  { href: '/teams', label: 'teams' },
  { href: '/players', label: 'players' },
  { href: '/players/compare', label: 'compare' },
  { href: '/predictions', label: 'predictions' },
  { href: '/dashboard', label: 'dashboard' },
] as const

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const t = useTranslations('Navigation')
  const pathname = usePathname()
  const active = [...links].reverse().find(({ href }) => pathname === href || pathname.startsWith(`${href}/`))

  return (
    <nav aria-label={t('primary')} className={mobile ? 'grid gap-1' : 'hidden items-center gap-4 xl:flex'}>
      {links.map(({ href, label }) => {
        const link = (
          <Link
            href={href}
            aria-current={active?.href === href ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap text-sm font-medium transition-colors hover:text-foreground',
              active?.href === href ? 'text-foreground' : 'text-muted-foreground',
              mobile && 'rounded-md px-3 py-2.5 hover:bg-muted',
            )}
          >
            {t(label)}
          </Link>
        )
        return mobile ? <DialogClose asChild key={href}>{link}</DialogClose> : <div key={href}>{link}</div>
      })}
    </nav>
  )
}

export function Header() {
  const t = useTranslations('Navigation')

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <BrandLink />
        <Navigation />
        <div className="flex shrink-0 items-center gap-1">
          <PwaInstall />
          <GlobalSearch />
          <LanguageSwitch />
          <ThemeToggle />
          <Dialog>
            <DialogTrigger asChild>
              <Button className="xl:hidden" variant="ghost" size="icon" aria-label={t('menu')}>
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <DialogContent aria-describedby={undefined} className="w-[calc(100%-2rem)] max-h-[85dvh] overflow-y-auto rounded-xl">
              <DialogTitle>{t('menu')}</DialogTitle>
              <Navigation mobile />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  )
}
