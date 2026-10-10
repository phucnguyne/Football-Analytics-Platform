'use client'

import { useMatchLive } from '@/hooks/useMatchLive'
import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export function LiveScoreboard() {
  const { liveMatchesArray, isConnected, isInitializing } = useMatchLive()

  if (isInitializing || liveMatchesArray.length === 0) {
    return null;
  }

  // Filter for only active matches if preferred, or show all in array.
  // We'll show all currently tracked matches (IN_PLAY, PAUSED, LIVE)
  const activeMatches = liveMatchesArray.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED' || m.status === 'LIVE' || m.status === 'FINISHED');

  if (activeMatches.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-slate-900 text-white overflow-x-auto whitespace-nowrap border-b border-slate-800" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <div className="flex items-center px-4 py-2 space-x-6 min-w-max">
        <div className="flex items-center space-x-2 text-red-500 font-bold text-sm shrink-0">
          <span className="relative flex h-3 w-3">
            <span className={cn("absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75", isConnected ? "animate-ping" : "hidden")}></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span>LIVE</span>
        </div>
        
        {activeMatches.map(match => (
          <Link 
            key={match.matchId} 
            href={`/matches/${match.matchId}`}
            className="flex items-center space-x-3 hover:bg-slate-800 px-3 py-1 rounded transition-colors"
          >
            <div className="flex items-center space-x-2 text-sm font-medium">
              <span className="w-12 text-right truncate" title={match.homeTeamName}>
                {match.homeTeamShortName || match.homeTeamName.substring(0,3).toUpperCase()}
              </span>
              {match.homeTeamCrest ? (
                <Image src={match.homeTeamCrest} alt={match.homeTeamShortName} width={20} height={20} className="w-5 h-5 object-contain" />
              ) : (
                <div className="w-5 h-5 bg-slate-700 rounded-full" />
              )}
            </div>
            
            <div className="flex flex-col items-center justify-center min-w-[3.5rem] bg-slate-950 px-2 py-1 rounded">
              <div className="text-[10px] text-green-400 font-semibold mb-0.5">
                {match.status === 'IN_PLAY' && match.minute ? `${match.minute}'` : match.status === 'PAUSED' ? 'HT' : match.status === 'FINISHED' ? 'FT' : match.status}
              </div>
              <div className="font-bold text-sm leading-none">
                {match.homeGoals ?? 0} - {match.awayGoals ?? 0}
              </div>
            </div>

            <div className="flex items-center space-x-2 text-sm font-medium">
              {match.awayTeamCrest ? (
                <Image src={match.awayTeamCrest} alt={match.awayTeamShortName} width={20} height={20} className="w-5 h-5 object-contain" />
              ) : (
                <div className="w-5 h-5 bg-slate-700 rounded-full" />
              )}
              <span className="w-12 text-left truncate" title={match.awayTeamName}>
                {match.awayTeamShortName || match.awayTeamName.substring(0,3).toUpperCase()}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

