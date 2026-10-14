export interface HeatPoint {
  x: number // 0 to 100 (% of pitch length, 0 = own goal, 100 = opponent goal)
  y: number // 0 to 100 (% of pitch width, 0 = left touchline, 100 = right touchline)
  intensity: number // 0.1 to 1.0
}

export interface ZoneBreakdown {
  leftFlank: number
  center: number
  rightFlank: number
  defensiveThird: number
  middleThird: number
  attackingThird: number
  boxTouches: number
  totalTouches: number
}

export interface PassingNode {
  id: number
  name: string
  shortName: string
  shirtNumber: number
  position: string
  x: number // Average x coordinate (0 to 100)
  y: number // Average y coordinate (0 to 100)
  touches: number
}

export interface PassingLink {
  source: number // Player ID
  target: number // Player ID
  count: number // Number of passes between them
  direction: 'source_to_target' | 'target_to_source' | 'bidirectional'
}

export interface BuildUpMetrics {
  /** Possession percentage (0-100) */
  possession: number
  /** Build-up style preference */
  buildUpStyle: 'Short-Passing' | 'Direct' | 'Mixed' | 'Long-Ball'
  /** Avg passes per sequence before a final-third entry */
  passesPerSequence: number
  /** Final-third entry method breakdown (%) */
  finalThirdEntries: {
    carry: number    // dribble / progressive carry
    pass: number     // ground or aerial pass
    setPiece: number // corner / throw-in / free kick
  }
  /** Progressive carries per 90 minutes */
  progressiveCarriesPer90: number
  /** Field zones where team most often triggers the press (% of press events) */
  pressTriggerZones: {
    ownHalf: number
    middleThird: number
    highPress: number // opponent half
  }
  /** Ball retention under pressure (%) */
  retentionUnderPressure: number
  /** Vertical compactness: distance between def/att lines (metres, lower = more compact) */
  compactness: number
  /** Counter-attack speed: avg seconds from regain to shot attempt */
  counterAttackSpeed: number
  /** PPDA split: own half vs opponent half */
  ppdaOwn: number
  ppdaOpp: number
}

export interface TeamTactics {
  id: number
  name: string
  shortName: string
  crest?: string
  formation: string
  ppda: number // Passes Allowed Per Defensive Action (e.g. 8.5)
  fieldTilt: number // Percentage (0-100)
  highPressEfficiency: number // Percentage
  avgPassLength: number // meters
  defensiveLineHeight: 'Deep' | 'Mid' | 'High'
  turnoversWonHigh: number
  counterPressRecoveries: number
  /** Phase 11: Attacking build-up & ball control metrics */
  buildUp: BuildUpMetrics
  passingNetwork: {
    nodes: PassingNode[]
    links: PassingLink[]
    topCombinations: { from: string; to: string; count: number }[]
    centralPlayer: string
  }
  heatmaps: {
    teamPoints: HeatPoint[]
    players: Record<number, { points: HeatPoint[]; zones: ZoneBreakdown }>
  }
}

export interface MatchTacticsResponse {
  matchId: number
  homeTeam: TeamTactics
  awayTeam: TeamTactics
  summary: {
    territorialDominance: string
    pressingBattle: string
    buildUpStyle: string
  }
}

// Pseudo-random deterministic generator based on seed string/number
function seededRandom(seed: number) {
  let s = Math.sin(seed++) * 10000
  return s - Math.floor(s)
}

// Generate nominal average coordinates for standard 4-3-3 / 4-2-3-1 formations
const DEFAULT_COORDS: Record<string, { x: number; y: number }> = {
  GK: { x: 10, y: 50 },
  LB: { x: 35, y: 15 },
  CB_L: { x: 28, y: 35 },
  CB_R: { x: 28, y: 65 },
  RB: { x: 35, y: 85 },
  DM: { x: 44, y: 50 },
  CM_L: { x: 55, y: 32 },
  CM_R: { x: 55, y: 68 },
  LW: { x: 74, y: 18 },
  ST: { x: 80, y: 50 },
  RW: { x: 74, y: 82 },
}

/**
 * Generates rich, realistic tactical coordinates and metrics
 */
export function generateTacticalData(
  matchId: number,
  homeTeam: { id: number; name: string; shortName: string; crest?: string; lineup?: any[] },
  awayTeam: { id: number; name: string; shortName: string; crest?: string; lineup?: any[] }
): MatchTacticsResponse {
  const seedBase = matchId * 1337

  const generateTeamTactics = (
    team: { id: number; name: string; shortName: string; crest?: string; lineup?: any[] },
    isHome: boolean
  ): TeamTactics => {
    const seed = seedBase + (isHome ? 100 : 200)

    // Fallback lineup if none provided
    const lineup = team.lineup && team.lineup.length >= 11
      ? team.lineup.slice(0, 11)
      : [
          { id: team.id * 100 + 1, name: 'Goalkeeper', shirtNumber: 1, position: 'GK' },
          { id: team.id * 100 + 2, name: 'Left Back', shirtNumber: 3, position: 'LB' },
          { id: team.id * 100 + 3, name: 'Center Back L', shirtNumber: 4, position: 'CB_L' },
          { id: team.id * 100 + 4, name: 'Center Back R', shirtNumber: 6, position: 'CB_R' },
          { id: team.id * 100 + 5, name: 'Right Back', shirtNumber: 2, position: 'RB' },
          { id: team.id * 100 + 6, name: 'Defensive Mid', shirtNumber: 5, position: 'DM' },
          { id: team.id * 100 + 7, name: 'Central Mid L', shirtNumber: 8, position: 'CM_L' },
          { id: team.id * 100 + 8, name: 'Central Mid R', shirtNumber: 10, position: 'CM_R' },
          { id: team.id * 100 + 9, name: 'Left Winger', shirtNumber: 11, position: 'LW' },
          { id: team.id * 100 + 10, name: 'Striker', shirtNumber: 9, position: 'ST' },
          { id: team.id * 100 + 11, name: 'Right Winger', shirtNumber: 7, position: 'RW' },
        ]

    const posKeys = Object.keys(DEFAULT_COORDS)
    const nodes: PassingNode[] = lineup.map((p, idx) => {
      const posKey = posKeys[idx % posKeys.length]
      const baseCoord = DEFAULT_COORDS[posKey] || { x: 50, y: 50 }
      
      const jitterX = (seededRandom(seed + idx * 7) - 0.5) * 8
      const jitterY = (seededRandom(seed + idx * 11) - 0.5) * 10
      const touches = Math.floor(35 + seededRandom(seed + idx * 17) * 55)

      return {
        id: p.id,
        name: p.name,
        shortName: p.name.split(' ').slice(-1)[0] || p.name,
        shirtNumber: p.shirtNumber || (idx + 1),
        position: p.position || posKey,
        x: Math.min(92, Math.max(8, Math.round(baseCoord.x + jitterX))),
        y: Math.min(92, Math.max(8, Math.round(baseCoord.y + jitterY))),
        touches,
      }
    })

    // Generate passing links between players
    const links: PassingLink[] = []
    const topCombs: { from: string; to: string; count: number }[] = []

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const p1 = nodes[i]
        const p2 = nodes[j]

        // Closer players exchange more passes
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
        if (dist < 45) {
          const passChance = seededRandom(seed + i * 29 + j * 31)
          if (passChance > 0.35) {
            const count = Math.max(4, Math.floor((50 - dist) * 0.8 * (0.8 + seededRandom(seed + i + j) * 0.6)))
            links.push({
              source: p1.id,
              target: p2.id,
              count,
              direction: 'bidirectional',
            })

            topCombs.push({
              from: p1.shortName,
              to: p2.shortName,
              count,
            })
          }
        }
      }
    }

    topCombs.sort((a, b) => b.count - a.count)

    // Central player (highest passes/touches)
    const centralPlayerNode = [...nodes].sort((a, b) => b.touches - a.touches)[0]

    // Team Heatmap Points & Individual Player Heatmaps
    const teamPoints: HeatPoint[] = []
    const playersHeatmaps: Record<number, { points: HeatPoint[]; zones: ZoneBreakdown }> = {}

    nodes.forEach((node, nodeIdx) => {
      const pPoints: HeatPoint[] = []
      const pointCount = 35 + Math.floor(seededRandom(seed + nodeIdx * 19) * 25)

      let leftCount = 0
      let centerCount = 0
      let rightCount = 0
      let defThird = 0
      let midThird = 0
      let attThird = 0
      let boxTouches = 0

      for (let k = 0; k < pointCount; k++) {
        const angle = seededRandom(seed + nodeIdx * 53 + k * 13) * Math.PI * 2
        const spread = seededRandom(seed + nodeIdx * 37 + k * 23) * 16

        const px = Math.min(96, Math.max(4, Math.round(node.x + Math.cos(angle) * spread * 1.3)))
        const py = Math.min(96, Math.max(4, Math.round(node.y + Math.sin(angle) * spread)))
        const intensity = 0.3 + seededRandom(seed + nodeIdx + k) * 0.7

        const pt: HeatPoint = { x: px, y: py, intensity: parseFloat(intensity.toFixed(2)) }
        pPoints.push(pt)
        teamPoints.push(pt)

        // Zone counts
        if (py < 33) leftCount++
        else if (py > 67) rightCount++
        else centerCount++

        if (px < 33) defThird++
        else if (px > 67) attThird++
        else midThird++

        if (px > 83 && py > 20 && py < 80) boxTouches++
      }

      const total = pointCount
      playersHeatmaps[node.id] = {
        points: pPoints,
        zones: {
          leftFlank: Math.round((leftCount / total) * 100),
          center: Math.round((centerCount / total) * 100),
          rightFlank: Math.round((rightCount / total) * 100),
          defensiveThird: Math.round((defThird / total) * 100),
          middleThird: Math.round((midThird / total) * 100),
          attackingThird: Math.round((attThird / total) * 100),
          boxTouches,
          totalTouches: node.touches,
        },
      }
    })

    // PPDA calculation: Top pressing teams have lower PPDA (7-11), conservative teams (12-18)
    const ppdaBase = isHome ? 8.2 + seededRandom(seed + 1) * 4.5 : 10.5 + seededRandom(seed + 2) * 6.0
    const fieldTilt = isHome ? 58 - Math.floor(seededRandom(seed + 3) * 12) : 42 + Math.floor(seededRandom(seed + 4) * 10)

    // ── Build-Up Metrics (Phase 11) ──────────────────────────────────────────
    const possession = isHome
      ? Math.round(46 + seededRandom(seed + 50) * 18)
      : Math.round(38 + seededRandom(seed + 51) * 18)

    const styleIdx   = Math.floor(seededRandom(seed + 52) * 4)
    const STYLES: BuildUpMetrics['buildUpStyle'][] = ['Short-Passing', 'Direct', 'Mixed', 'Long-Ball']
    const buildUpStyle = STYLES[styleIdx]

    const carryPct    = Math.round(20 + seededRandom(seed + 53) * 30)  // 20-50
    const setPiecePct = Math.round(8  + seededRandom(seed + 54) * 15)  // 8-23
    const passPct     = 100 - carryPct - setPiecePct

    // Pressing trigger zone split (must sum to 100)
    const ownHalfPress    = Math.round(15 + seededRandom(seed + 55) * 20) // 15-35
    const highPressZone   = Math.round(20 + seededRandom(seed + 56) * 35) // 20-55
    const midThirdPress   = 100 - ownHalfPress - highPressZone

    const buildUp: BuildUpMetrics = {
      possession,
      buildUpStyle,
      passesPerSequence:        parseFloat((3.5 + seededRandom(seed + 57) * 4.5).toFixed(1)),
      finalThirdEntries: {
        carry:    carryPct,
        pass:     passPct,
        setPiece: setPiecePct,
      },
      progressiveCarriesPer90:  parseFloat((6 + seededRandom(seed + 58) * 12).toFixed(1)),
      pressTriggerZones: {
        ownHalf:     ownHalfPress,
        middleThird: Math.max(10, midThirdPress),
        highPress:   highPressZone,
      },
      retentionUnderPressure:   Math.round(55 + seededRandom(seed + 59) * 30),
      compactness:              parseFloat((22 + seededRandom(seed + 60) * 18).toFixed(1)),
      counterAttackSpeed:       parseFloat((5.5 + seededRandom(seed + 61) * 7).toFixed(1)),
      ppdaOwn:                  parseFloat((ppdaBase * 0.85).toFixed(1)),
      ppdaOpp:                  parseFloat((ppdaBase * 1.25).toFixed(1)),
    }

    return {
      id: team.id,
      name: team.name,
      shortName: team.shortName || team.name,
      crest: team.crest,
      formation: isHome ? '4-3-3' : '4-2-3-1',
      ppda: parseFloat(ppdaBase.toFixed(1)),
      fieldTilt,
      highPressEfficiency: Math.round(62 + seededRandom(seed + 5) * 26),
      avgPassLength: parseFloat((16.2 + seededRandom(seed + 6) * 4.5).toFixed(1)),
      defensiveLineHeight: ppdaBase < 10.5 ? 'High' : ppdaBase < 14 ? 'Mid' : 'Deep',
      turnoversWonHigh: Math.floor(7 + seededRandom(seed + 7) * 9),
      counterPressRecoveries: Math.floor(18 + seededRandom(seed + 8) * 16),
      buildUp,
      passingNetwork: {
        nodes,
        links,
        topCombinations: topCombs.slice(0, 4),
        centralPlayer: centralPlayerNode?.name || 'Playmaker',
      },
      heatmaps: {
        teamPoints,
        players: playersHeatmaps,
      },
    }
  }

  const homeTactics = generateTeamTactics(homeTeam, true)
  const awayTactics = generateTeamTactics(awayTeam, false)

  // Overall qualitative tactical summary
  const homeDom = homeTactics.fieldTilt > 50
  const summary = {
    territorialDominance: `${homeDom ? homeTactics.shortName : awayTactics.shortName} controlled ${Math.max(homeTactics.fieldTilt, awayTactics.fieldTilt)}% of final-third territory (Field Tilt).`,
    pressingBattle: `${homeTactics.ppda < awayTactics.ppda ? homeTactics.shortName : awayTactics.shortName} maintained higher pressing intensity with a PPDA of ${Math.min(homeTactics.ppda, awayTactics.ppda)}.`,
    buildUpStyle: `${homeTactics.shortName} leveraged a progressive ${homeTactics.formation} system with ${homeTactics.passingNetwork.centralPlayer} orchestrating possession build-up.`,
  }

  return {
    matchId,
    homeTeam: homeTactics,
    awayTeam: awayTactics,
    summary,
  }
}

