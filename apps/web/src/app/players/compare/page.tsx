'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Container } from '@/components/ui/grid'
import { PageSpinner } from '@/components/ui/Spinner'
import { PlayerComparisonDashboard } from '@/components/players/PlayerComparisonDashboard'

function CompareContent() {
  const searchParams = useSearchParams()
  const p1Param = searchParams.get('p1')
  const p2Param = searchParams.get('p2')

  const player1Id = p1Param ? parseInt(p1Param) : 100000
  const player2Id = p2Param ? parseInt(p2Param) : undefined

  return (
    <Container className="py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/players"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            ← Back to Players
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">Player Scouting Comparison</h1>
          <p className="text-muted-foreground text-sm">
            Compare tactical performance profiles, radar shapes, and advanced metrics across players
          </p>
        </div>
      </div>

      <PlayerComparisonDashboard
        initialPlayer1Id={player1Id}
        initialPlayer2Id={player2Id}
      />
    </Container>
  )
}

export default function ComparePlayersPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <CompareContent />
    </Suspense>
  )
}

