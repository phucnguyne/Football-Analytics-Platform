import type { Prisma } from '@app/database'

// Type for a Match with all its common includes
type MatchWithIncludes = Prisma.MatchGetPayload<{
  include: {
    homeTeam: true
    awayTeam: true
    score: true
    league: true
  }
}>

type MatchWithDetails = Prisma.MatchGetPayload<{
  include: {
    homeTeam: true
    awayTeam: true
    score: true
    league: true
    events: { include: { player: true; relatedPlayer: true } }
    lineups: { include: { player: true; team: true } }
    statistics: true
  }
}>

/** Convert a Prisma Team row to football-data.org API shape */
export function toTeamResponse(t: { id: number; name: string; shortName: string; crest: string | null; founded: number | null; venue: string | null }) {
  return {
    id: t.id,
    name: t.name,
    shortName: t.shortName,
    tla: t.shortName,
    crest: t.crest,
    founded: t.founded,
    venue: t.venue,
  }
}

/** Convert a Prisma Match (with includes) to football-data.org API shape */
export function toMatchResponse(m: MatchWithIncludes) {
  return {
    id: m.id,
    utcDate: m.utcDate.toISOString(),
    status: m.status,
    matchday: m.matchday,
    stage: m.stage,
    lastUpdated: m.lastUpdated?.toISOString() ?? null,
    homeTeam: toTeamResponse(m.homeTeam),
    awayTeam: toTeamResponse(m.awayTeam),
    score: m.score ? {
      winner: m.score.winner === 'HOME' ? 'HOME_TEAM' : m.score.winner === 'AWAY' ? 'AWAY_TEAM' : m.score.winner,
      duration: m.score.duration === 'PENALTY' ? 'PENALTY_SHOOTOUT' : m.score.duration,
      fullTime: {
        home: m.score.homeTeamGoals,
        away: m.score.awayTeamGoals,
      },
      halfTime: {
        home: m.score.homeTeamGoalsHT,
        away: m.score.awayTeamGoalsHT,
      },
      extraTime: {
        home: m.score.scoreExtraTimeHome,
        away: m.score.scoreExtraTimeAway,
      },
      penalties: {
        home: m.score.scorePenaltyHome,
        away: m.score.scorePenaltyAway,
      },
    } : {
      winner: null,
      duration: 'REGULAR',
      fullTime: { home: null, away: null },
      halfTime: { home: null, away: null },
    },
    competition: {
      id: m.league.id,
      name: m.league.name,
      emblem: m.league.emblem,
    },
    prediction: m.winProbHome != null ? {
      homeWin: m.winProbHome,
      draw: m.winProbDraw,
      awayWin: m.winProbAway
    } : null,
  }
}

/** Convert a Prisma Match with full details to the football-data.org single-match shape */
export function toMatchDetailResponse(m: MatchWithDetails) {
  const base = toMatchResponse(m as MatchWithIncludes)

  // Build goals from MatchEvents of type GOAL/OWN_GOAL/PENALTY_GOAL
  const goals = m.events
    .filter(e => ['GOAL', 'OWN_GOAL', 'PENALTY_GOAL'].includes(e.type))
    .sort((a, b) => a.minute - b.minute)
    .map(e => ({
      minute: e.minute,
      injuryTime: e.minuteExtra ?? null,
      type: e.type === 'OWN_GOAL' ? 'OWN' : e.type === 'PENALTY_GOAL' ? 'PENALTY' : 'REGULAR',
      team: e.team === 'HOME'
        ? { id: m.homeTeam.id, name: m.homeTeam.name }
        : { id: m.awayTeam.id, name: m.awayTeam.name },
      scorer: e.player ? { id: e.player.id, name: e.player.name } : null,
      assist: e.relatedPlayer ? { id: e.relatedPlayer.id, name: e.relatedPlayer.name } : null,
      xG: (e as any).xG,
      x: (e as any).x,
      y: (e as any).y
    }))

  // Build shots from SHOT events
  const shots = m.events
    .filter(e => e.type === 'SHOT')
    .sort((a, b) => a.minute - b.minute)
    .map(e => ({
      minute: e.minute,
      type: 'SHOT',
      team: e.team === 'HOME'
        ? { id: m.homeTeam.id, name: m.homeTeam.name }
        : { id: m.awayTeam.id, name: m.awayTeam.name },
      player: e.player ? { id: e.player.id, name: e.player.name } : null,
      xG: (e as any).xG,
      x: (e as any).x,
      y: (e as any).y
    }))

  // Build bookings from YELLOW_CARD/SECOND_YELLOW/RED_CARD events
  const bookings = m.events
    .filter(e => ['YELLOW_CARD', 'SECOND_YELLOW', 'RED_CARD'].includes(e.type))
    .sort((a, b) => a.minute - b.minute)
    .map(e => ({
      minute: e.minute,
      team: e.team === 'HOME'
        ? { id: m.homeTeam.id, name: m.homeTeam.name }
        : { id: m.awayTeam.id, name: m.awayTeam.name },
      player: e.player ? { id: e.player.id, name: e.player.name } : null,
      card: e.type === 'SECOND_YELLOW' ? 'SECOND_YELLOW' : e.type === 'RED_CARD' ? 'RED' : 'YELLOW_CARD',
    }))

  // Build substitutions from SUBSTITUTION events
  const substitutions = m.events
    .filter(e => e.type === 'SUBSTITUTION')
    .sort((a, b) => a.minute - b.minute)
    .map(e => ({
      minute: e.minute,
      team: e.team === 'HOME'
        ? { id: m.homeTeam.id, name: m.homeTeam.name }
        : { id: m.awayTeam.id, name: m.awayTeam.name },
      playerOut: e.player ? { id: e.player.id, name: e.player.name } : null,
      playerIn: e.relatedPlayer ? { id: e.relatedPlayer.id, name: e.relatedPlayer.name } : null,
    }))

  // Build lineups
  const homeLineup = m.lineups
    .filter(l => l.teamId === m.homeTeamId)
    .map(l => ({
      id: l.player.id,
      name: l.player.name,
      position: l.position,
      shirtNumber: l.shirtNumber,
    }))

  const awayLineup = m.lineups
    .filter(l => l.teamId === m.awayTeamId)
    .map(l => ({
      id: l.player.id,
      name: l.player.name,
      position: l.position,
      shirtNumber: l.shirtNumber,
    }))

  return {
    ...base,
    goals,
    shots,
    bookings,
    substitutions,
    homeTeam: {
      ...base.homeTeam,
      lineup: homeLineup.filter(l => m.lineups.find(ml => ml.playerId === l.id)?.isStarter),
      bench: homeLineup.filter(l => !m.lineups.find(ml => ml.playerId === l.id)?.isStarter),
    },
    awayTeam: {
      ...base.awayTeam,
      lineup: awayLineup.filter(l => m.lineups.find(ml => ml.playerId === l.id)?.isStarter),
      bench: awayLineup.filter(l => !m.lineups.find(ml => ml.playerId === l.id)?.isStarter),
    },
    referees: [],
  }
}

