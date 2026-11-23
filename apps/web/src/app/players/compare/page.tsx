"use client";

import { useTranslations } from 'next-intl'
import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/grid";
import { ChartSkeleton, PageSkeleton } from "@/components/ui/Skeleton";

const PlayerComparisonDashboard = dynamic(
  () =>
    import("@/components/players/PlayerComparisonDashboard").then((module) => ({
      default: module.PlayerComparisonDashboard,
    })),
  {
    loading: () => (
      <ChartSkeleton className="h-[640px]" />
    ),
    ssr: false,
  },
);

function CompareContent() {
  const t = useTranslations('Compare')
  const searchParams = useSearchParams();
  const p1Param = searchParams.get("p1");
  const p2Param = searchParams.get("p2");

  const parsedPlayer1Id = p1Param ? Number(p1Param) : undefined;
  const parsedPlayer2Id = p2Param ? Number(p2Param) : undefined;
  const player1Id =
    parsedPlayer1Id && Number.isInteger(parsedPlayer1Id) && parsedPlayer1Id > 0
      ? parsedPlayer1Id
      : undefined;
  const player2Id =
    parsedPlayer2Id && Number.isInteger(parsedPlayer2Id) && parsedPlayer2Id > 0
      ? parsedPlayer2Id
      : undefined;
  const parsedPlayer1TeamId = Number(searchParams.get("p1TeamId"));
  const parsedPlayer2TeamId = Number(searchParams.get("p2TeamId"));
  const player1TeamId =
    Number.isInteger(parsedPlayer1TeamId) && parsedPlayer1TeamId > 0
      ? parsedPlayer1TeamId
      : undefined;
  const player2TeamId =
    Number.isInteger(parsedPlayer2TeamId) && parsedPlayer2TeamId > 0
      ? parsedPlayer2TeamId
      : undefined;

  return (
    <Container className="py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/players"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            ← {t('back')}
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('intro')}
          </p>
        </div>
      </div>

      <PlayerComparisonDashboard
        initialPlayer1Id={player1Id}
        initialPlayer2Id={player2Id}
        initialPlayer1TeamId={player1TeamId}
        initialPlayer2TeamId={player2TeamId}
      />
    </Container>
  );
}

export default function ComparePlayersPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="detail" />}>
      <CompareContent />
    </Suspense>
  );
}
