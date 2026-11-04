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