'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MAX_SEARCH_LENGTH, MIN_SEARCH_LENGTH, type SearchResults } from '@/lib/search'

export function GlobalSearch() {
  const t = useTranslations('Search')
  const format = useFormatter()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const term = input.trim()
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setQuery(term), 250)
    return () => window.clearTimeout(timer)
  }, [open, term])

  const ready = open && term.length >= MIN_SEARCH_LENGTH && term === query
  const { data, isError, isPending, refetch } = useQuery<SearchResults>({
    queryKey: ['global-search', query],
    enabled: ready,
    retry: false,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`, { signal })
      if (!response.ok) throw new Error('Search request failed')
      return response.json()
    },
  })

  const groups = ready && data ? [
    {
      title: t('players'),
      items: data.players.map(({ id, name, team }) => ({
        href: `/players/${id}`, name, detail: team?.name,
      })),
    },
    {
      title: t('teams'),
      items: data.teams.map(({ id, name }) => ({ href: `/teams/${id}`, name, detail: undefined })),
    },
    {
      title: t('matches'),
      items: data.matches.map(({ id, home, away, utcDate, league }) => ({
        href: `/matches/${id}`,
        name: t('fixture', { home, away }),
        detail: `${league} · ${format.dateTime(new Date(utcDate), { dateStyle: 'medium', timeZone })}`,
      })),
    },
  ].filter(({ items }) => items.length > 0) : []

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next)
      if (!next) {
        setInput('')
        setQuery('')
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('title')}>
          <Search aria-hidden="true" className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-2rem)] max-h-[85dvh] overflow-y-auto rounded-xl">
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription>{t('description')}</DialogDescription>
        <Input type="search" value={input} onChange={(event) => setInput(event.target.value)}
          placeholder={t('placeholder')} aria-label={t('title')} maxLength={MAX_SEARCH_LENGTH} />
        {term.length >= MIN_SEARCH_LENGTH && (!ready || isPending) && (
          <p role="status" className="text-sm text-muted-foreground">{t('loading')}</p>
        )}
        {ready && isError && (
          <div className="flex items-center justify-between gap-3">
            <p role="alert" className="text-sm text-muted-foreground">{t('error')}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>{t('retry')}</Button>
          </div>
        )}
        {ready && !isError && data && groups.length === 0 && (
          <p role="status" className="text-sm text-muted-foreground">{t('empty')}</p>
        )}
        {!isError && groups.map(({ title, items }) => (
          <section key={title} aria-label={title}>
            <h2 className="px-2 text-xs font-semibold uppercase text-muted-foreground">{title}</h2>
            <ul className="mt-1">
              {items.map(({ href, name, detail }) => (
                <li key={href}>
                  <DialogClose asChild>
                    <Link href={href} className="block rounded-md px-2 py-2 text-sm hover:bg-muted focus-visible:bg-muted">
                      <span className="font-medium">{name}</span>
                      {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
                    </Link>
                  </DialogClose>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  )
}
