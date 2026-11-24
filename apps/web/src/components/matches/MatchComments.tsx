'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { loginLink } from '@/lib/login-link'

type CommentPage = {
  comments: { id: number; author: string | null; body: string; createdAt: string; canDelete: boolean }[]
  nextCursor: number | null
}

export function MatchComments({ matchId }: { matchId: string }) {
  const t = useTranslations('Social')
  const common = useTranslations('Common')
  const format = useFormatter()
  const { data: session, status } = useSession()
  const [body, setBody] = useState('')
  const queryClient = useQueryClient()
  const queryKey = ['match-comments', matchId, session?.user.id]
  const url = `/api/matches/${matchId}/comments`

  const list = useInfiniteQuery({
    queryKey,
    enabled: status !== 'loading',
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage: CommentPage) => lastPage.nextCursor,
    queryFn: async ({ signal, pageParam }): Promise<CommentPage> => {
      const result = await fetch(pageParam ? `${url}?before=${pageParam}` : url, { signal })
      if (!result.ok) throw new Error('Comment request failed')
      return result.json()
    },
  })
  const mutation = useMutation({
    mutationFn: async (action: { body: string } | { id: number }) => {
      const response = 'body' in action
        ? await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) })
        : await fetch(`${url}/${action.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(response.status === 429 ? 'rate' : 'error')
    },
    onSuccess: (_value, action) => {
      if ('body' in action) setBody('')
      void queryClient.invalidateQueries({ queryKey: ['match-comments', matchId] })
    },
  })
  const comments = list.data?.pages.flatMap((page) => page.comments)

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-bold">{t('comments')}</h2>
      {session?.user.id ? (
        <form className="space-y-2" onSubmit={(event) => {
          event.preventDefault()
          if (body.trim()) mutation.mutate({ body: body.trim() })
        }}>
          <label className="sr-only" htmlFor="match-comment">{t('write')}</label>
          <textarea id="match-comment" value={body} onChange={(event) => setBody(event.target.value)}
            placeholder={t('write')} rows={3} maxLength={1000} required
            className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm" />
          <Button type="submit" size="sm" disabled={mutation.isPending || !body.trim()}>{t('post')}</Button>
        </form>
      ) : status === 'unauthenticated' && (
        <Link href={loginLink(`/matches/${matchId}`)} className="text-sm text-primary hover:underline">{t('signInToComment')}</Link>
      )}
      {mutation.isError && <p role="alert" className="text-sm text-destructive">
        {mutation.error.message === 'rate' ? t('rate') : common('error')}
      </p>}
      {list.isPending && <p role="status" className="text-sm text-muted-foreground">{common('loading')}</p>}
      {list.isError && <Button type="button" size="sm" variant="outline" onClick={() => list.refetch()}>{common('retry')}</Button>}
      {comments?.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
      <ul className="space-y-3">
        {comments?.map((item) => (
          <li key={item.id} className="border-t pt-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{item.author || t('fan')}</span>
              <time dateTime={item.createdAt}>{format.dateTime(new Date(item.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}</time>
              {item.canDelete && (
                <button type="button" onClick={() => mutation.mutate({ id: item.id })}
                  disabled={mutation.isPending} className="ml-auto text-destructive hover:underline">{t('remove')}</button>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.body}</p>
          </li>
        ))}
      </ul>
      {list.hasNextPage && (
        <Button type="button" size="sm" variant="outline" disabled={list.isFetchingNextPage}
          onClick={() => list.fetchNextPage()}>{t('more')}</Button>
      )}
    </section>
  )
}
