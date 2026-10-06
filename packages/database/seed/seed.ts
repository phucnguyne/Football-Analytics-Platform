import { PrismaClient, MatchStatus, Winner, Duration } from '@prisma/client'

const prisma = new PrismaClient()

// Read API Key directly from env if set, or hardcoded for seed
const API_KEY = process.env.FOOTBALL_DATA_API_KEY || '52f127abc9f54e359f4b73994f7c681b'
const API_URL = 'https://api.football-data.org/v4'
const COMPETITION_CODE = 'PL'

const headers = {
  'X-Auth-Token': API_KEY,
}

async function fetchFromApi(endpoint: string) {
  console.log(`Fetching ${endpoint}...`)
  const res = await fetch(`${API_URL}${endpoint}`, { headers })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${res.statusText}`)
  }
  return res.json()
}

async function main() {
  console.log('Seeding database from football-data.org API...')

  // 1. Fetch Competition & Season
  const compData = await fetchFromApi(`/competitions/${COMPETITION_CODE}`)
  
  const league = await prisma.league.upsert({
    where: { id: compData.id },
    update: {
      name: compData.name,
      country: compData.area?.name || 'Unknown',
      emblem: compData.emblem,
    },
    create: {
      id: compData.id,
      name: compData.name,
      country: compData.area?.name || 'Unknown',
      emblem: compData.emblem,
    },
  })
  
  const currentSeasonData = compData.currentSeason
  let season = null
  
  if (currentSeasonData) {
    const startYear = parseInt(currentSeasonData.startDate.split('-')[0])
    
    // Check if season exists
    const existingSeason = await prisma.season.findUnique({
      where: { leagueId_year: { leagueId: league.id, year: startYear } }
    })
    
    if (existingSeason) {
      season = await prisma.season.update({
        where: { id: existingSeason.id },
        update: {
          startDate: new Date(currentSeasonData.startDate),
          endDate: new Date(currentSeasonData.endDate),
          isCurrent: true,
        }
      })
    } else {
      season = await prisma.season.create({
        data: {
          leagueId: league.id,
          year: startYear,
          startDate: new Date(currentSeasonData.startDate),
          endDate: new Date(currentSeasonData.endDate),
          isCurrent: true,
        }
      })
    }
  }

  // 2. Fetch Teams
  const teamsData = await fetchFromApi(`/competitions/${COMPETITION_CODE}/teams`)
  
  for (const t of teamsData.teams) {
    const team = await prisma.team.upsert({
      where: { id: t.id },
      update: {
        name: t.name,
        shortName: t.shortName || t.tla || t.name,
        crest: t.crest,
        founded: t.founded,
        venue: t.venue,
      },
      create: {
        id: t.id,
        name: t.name,
        shortName: t.shortName || t.tla || t.name,
        crest: t.crest,
        founded: t.founded,
        venue: t.venue,
      }
    })
    
    if (season) {
      await prisma.teamSeason.upsert({
        where: {
          teamId_seasonId: { teamId: team.id, seasonId: season.id }
        },
        update: {},
        create: {
          teamId: team.id,
          seasonId: season.id,
        }
      })
    }
  }

  // 3. Fetch Matches
  const matchesData = await fetchFromApi(`/competitions/${COMPETITION_CODE}/matches`)
  
  let matchCount = 0
  for (const m of matchesData.matches) {
    // Only save matches where both teams exist in our DB
    const homeTeam = await prisma.team.findUnique({ where: { id: m.homeTeam.id } })
    const awayTeam = await prisma.team.findUnique({ where: { id: m.awayTeam.id } })
    
    if (!homeTeam || !awayTeam) continue;

    const matchStatusMap: Record<string, MatchStatus> = {
      'SCHEDULED': 'SCHEDULED',
      'TIMED': 'TIMED',
      'IN_PLAY': 'IN_PLAY',
      'PAUSED': 'PAUSED',
      'FINISHED': 'FINISHED',
      'POSTPONED': 'POSTPONED',
      'CANCELLED': 'CANCELLED',
      'SUSPENDED': 'SUSPENDED',
    }
    
    const mappedStatus = matchStatusMap[m.status] || 'SCHEDULED'

    const match = await prisma.match.upsert({
      where: { id: m.id },
      update: {
        utcDate: new Date(m.utcDate),
        status: mappedStatus,
        matchday: m.matchday,
        stage: m.stage,
        lastUpdated: m.lastUpdated ? new Date(m.lastUpdated) : null,
        homeTeamId: m.homeTeam.id,
        awayTeamId: m.awayTeam.id,
        leagueId: league.id,
        seasonId: season?.id,
        rawData: m,
      },
      create: {
        id: m.id,
        utcDate: new Date(m.utcDate),
        status: mappedStatus,
        matchday: m.matchday,
        stage: m.stage,
        lastUpdated: m.lastUpdated ? new Date(m.lastUpdated) : null,
        homeTeamId: m.homeTeam.id,
        awayTeamId: m.awayTeam.id,
        leagueId: league.id,
        seasonId: season?.id,
        rawData: m,
      }
    })

    // Upsert Match Score if exists
    if (m.score && (m.score.fullTime?.home !== null || m.score.halfTime?.home !== null)) {
      let winner: Winner | null = null
      if (m.score.winner === 'HOME_TEAM') winner = 'HOME'
      else if (m.score.winner === 'AWAY_TEAM') winner = 'AWAY'
      else if (m.score.winner === 'DRAW') winner = 'DRAW'
      
      let duration: Duration | null = null
      if (m.score.duration === 'REGULAR') duration = 'REGULAR'
      else if (m.score.duration === 'EXTRA_TIME') duration = 'EXTRA_TIME'
      else if (m.score.duration === 'PENALTY_SHOOTOUT') duration = 'PENALTY'

      await prisma.matchScore.upsert({
        where: { matchId: match.id },
        update: {
          homeTeamGoals: m.score.fullTime?.home ?? 0,
          awayTeamGoals: m.score.fullTime?.away ?? 0,
          homeTeamGoalsHT: m.score.halfTime?.home,
          awayTeamGoalsHT: m.score.halfTime?.away,
          winner,
          duration,
        },
        create: {
          matchId: match.id,
          homeTeamGoals: m.score.fullTime?.home ?? 0,
          awayTeamGoals: m.score.fullTime?.away ?? 0,
          homeTeamGoalsHT: m.score.halfTime?.home,
          awayTeamGoalsHT: m.score.halfTime?.away,
          winner,
          duration,
        }
      })
    }
    matchCount++
  }
  
  console.log(`Database seeded successfully! Saved ${teamsData.teams.length} teams and ${matchCount} matches.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
