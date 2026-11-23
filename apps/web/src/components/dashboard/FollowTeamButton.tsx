'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { loginLink } from '@/lib/login-link'

export function FollowTeamButton({ teamId }: { teamId: number }) {
  const t = useTranslations('Dashboard')
  const common = useTranslations('Common')
  const { data: session, status } = useSession()
  const client = useQueryClient()
  const userId = session?.user?.id
  const url = `/api/favorites/${teamId}`
  const queryKey = ['favorite-team', userId, teamId]
  const favorite = useQuery<{ favorite: boolean }>({
    queryKey,
    enabled: !!userId,
    queryFn: async ({ signal }) => {
      const res = await fetch(url, { signal })
      if (!res.ok) throw new Error()
      return res.json()
    },
  })
  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const res = await fetch(url, { method: next ? 'PUT' : 'DELETE' })
      if (!res.ok) throw new Error()
      return res.json() as Promise<{ favorite: boolean }>
    },
    onSuccess: (result) => {
      client.setQueryData(queryKey, result)
      void client.invalidateQueries({ queryKey: ['dashboard', userId] })
    },
  })

  if (status === 'loading') return null
  if (!userId) {
    return <Button asChild variant="outline"><Link href={loginLink(`/teams/${teamId}`)}>{t('follow')}</Link></Button>
  }

  const followed = favorite.data?.favorite ?? false
  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" aria-pressed={followed} disabled={favorite.isPending || toggle.isPending}
        onClick={() => favorite.isError ? favorite.refetch() : toggle.mutate(!followed)}>
        {favorite.isError ? common('retry') : t(followed ? 'unfollow' : 'follow')}
      </Button>
      {toggle.isError && <p role="alert" className="text-xs text-destructive">{common('error')}</p>}
    </div>
  )
}
