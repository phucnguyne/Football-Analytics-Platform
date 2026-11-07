export const COMPETITION_LEAGUE_IDS: Record<string, number> = {
  PL: 2021,
  BL1: 2002,
  SA: 2019,
  PD: 2014,
  FL1: 2015,
  PPL: 2017,
  ELC: 2016,
  DED: 2003,
  CL: 2001,
  WC: 2000,
}

export function getCompetitionLeagueId(code: string): number | undefined {
  return COMPETITION_LEAGUE_IDS[code.toUpperCase()]
}

export function parseSeasonIdentifier(value: string | null): number | undefined {
  if (!value) return undefined
  const season = Number(value)
  return Number.isInteger(season) && season > 0 ? season : undefined
}

export function getSeasonFilter(season: number | undefined) {
  if (season === undefined) return { isCurrent: true }
  return season >= 1800 ? { year: season } : { id: season }
}

export function getExternalSeasonQuery(seasonYear: number | undefined): string {
  return seasonYear ? `?season=${encodeURIComponent(seasonYear)}` : ''
}