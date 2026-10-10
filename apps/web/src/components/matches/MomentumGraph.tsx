'use client'

import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export function MomentumGraph({ matchId, isLive, homeTeam, awayTeam }: { matchId: string, isLive: boolean, homeTeam: any, awayTeam: any }) {
  const { data: stats } = useQuery({
    queryKey: ['match-stats', matchId],
    queryFn: async () => {
      const res = await fetch(`/api/matches/${matchId}/stats`)
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
    refetchInterval: isLive ? 60000 : false,
  })

  if (!stats || !stats.momentum || stats.momentum.length === 0) return null;

  return (
    <div className="bg-card p-6 rounded-2xl border mb-6">
      <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
        <span className="w-2 h-6 bg-primary rounded-full" />
        Match Momentum
      </h3>
      <p className="text-xs text-muted-foreground mb-6">Real-time pressure and dominance</p>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stats.momentum} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorHome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorAway" x1="0" y1="1" x2="0" y2="0">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="minute" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}'`} />
            <YAxis domain={[-100, 100]} hide={true} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
              labelFormatter={(label) => `Minute ${label}`}
              formatter={(value: number) => {
                if (value > 0) return [`${value}% Advantage`, homeTeam.shortName || homeTeam.name];
                return [`${Math.abs(value)}% Advantage`, awayTeam.shortName || awayTeam.name];
              }}
            />
            <ReferenceLine y={0} stroke="#334155" />
            
            {/* Split the area into home (positive) and away (negative) */}
            <Area 
              type="monotone" 
              dataKey={(d) => d.value > 0 ? d.value : 0} 
              stroke="#3b82f6" 
              fillOpacity={1} 
              fill="url(#colorHome)" 
              strokeWidth={2}
            />
            <Area 
              type="monotone" 
              dataKey={(d) => d.value < 0 ? d.value : 0} 
              stroke="#f97316" 
              fillOpacity={1} 
              fill="url(#colorAway)" 
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="flex justify-between text-xs mt-2 text-muted-foreground font-semibold px-2">
        <span className="text-blue-500">{homeTeam.shortName || homeTeam.name} Dominance</span>
        <span className="text-orange-500">{awayTeam.shortName || awayTeam.name} Dominance</span>
      </div>
    </div>
  )
}

