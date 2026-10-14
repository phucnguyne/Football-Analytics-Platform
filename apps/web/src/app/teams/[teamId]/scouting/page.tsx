'use client'

import { use } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Container } from '@/components/ui/grid'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { ScoutingReport } from '@/components/teams/ScoutingReport'
import type { ScoutingReport as ScoutingReportType } from '@/lib/scouting-generator'

async function fetchScoutingReport(teamId: string): Promise<ScoutingReportType> {
  const res = await fetch(`/api/teams/${teamId}/scouting`)
  if (!res.ok) throw new Error('Failed to fetch scouting report')
  return res.json()
}

export default function ScoutingReportPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = use(params)

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['scouting', teamId],
    queryFn: () => fetchScoutingReport(teamId),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000, // 5 min
  })

  if (isLoading) return <PageSpinner />
  if (isError || !report) return <ErrorMessage />

  return (
    <Container size="2xl" className="py-10 print:py-4 print:max-w-full">
      {/* Navigation — hidden in print */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <Link
          href={`/teams/${teamId}`}
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          ← Back to {report.teamName}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">Scouting Report</span>
      </div>

      <ScoutingReport report={report} />
    </Container>
  )
}

