'use client'

import React, { useState, useMemo } from 'react'
import { PitchCanvas } from './PitchCanvas'
import { TacticalTeamCrest } from './TacticalTeamCrest'
import { useTranslations } from 'next-intl'
import type { PassingNode, PassingLink } from '@/lib/tactics-generator'

interface PassingNetworkProps {
  nodes: (Omit<PassingNode, 'shirtNumber'> & { shirtNumber: number | null })[]
  links: Omit<PassingLink, 'direction'>[]
  teamName: string
  teamCrest?: string
}

export function PassingNetwork({
  nodes,
  links,
  teamName,
  teamCrest,
}: PassingNetworkProps) {
  const t = useTranslations('Match')
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null)
  const [filterMinPasses, setFilterMinPasses] = useState<number>(1)

  const activeLinks = links.filter((l) => l.count >= filterMinPasses)

  // O(1) Map lookup instead of O(n) nodes.find() called per link during render.
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const hoveredNode = hoveredNodeId ? nodeMap.get(hoveredNodeId) ?? null : null

  return (
    <div className="space-y-4">
      {/* Network Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-xl border">
        <div className="flex items-center gap-3">
          {teamCrest && (
            <TacticalTeamCrest src={teamCrest} name={teamName} />
          )}
          <div>
            <h4 className="font-bold text-sm tracking-tight">{t('passingNetwork', { team: teamName })}</h4>
            <p className="text-xs text-muted-foreground">
              {t('passingNetworkDescription')}
            </p>
          </div>
        </div>

        {/* Minimum passes filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t('minimumPasses')}</span>
          {[1, 5, 10, 15].map((threshold) => (
            <button
              key={threshold}
              onClick={() => setFilterMinPasses(threshold)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterMinPasses === threshold
                  ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                  : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              {threshold}+
            </button>
          ))}
        </div>
      </div>

      {/* Visual Pitch Network */}
      <div className="relative">
        <PitchCanvas theme="tactical-dark">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Passing Links */}
            {activeLinks.map((link, idx) => {
              const src = nodeMap.get(link.source)
              const tgt = nodeMap.get(link.target)
              if (!src || !tgt) return null

              const isConnectedToHovered =
                hoveredNodeId === null ||
                link.source === hoveredNodeId ||
                link.target === hoveredNodeId

              // Width from 0.8 to 3.5 based on pass count
              const strokeWidth = Math.min(3.2, Math.max(0.7, (link.count / 30) * 3))
              const opacity = isConnectedToHovered ? (hoveredNodeId ? 0.95 : 0.65) : 0.12

              return (
                <g key={idx}>
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={hoveredNodeId && isConnectedToHovered ? '#38bdf8' : 'url(#linkGradient)'}
                    strokeWidth={hoveredNodeId && isConnectedToHovered ? strokeWidth + 0.6 : strokeWidth}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                    className="transition-all duration-200"
                  />
                </g>
              )
            })}

            {/* Player Nodes */}
            {nodes.map((node) => {
              const isHovered = hoveredNodeId === node.id
              const isConnected =
                hoveredNodeId === null ||
                hoveredNodeId === node.id ||
                activeLinks.some(
                  (l) =>
                    (l.source === hoveredNodeId && l.target === node.id) ||
                    (l.target === hoveredNodeId && l.source === node.id)
                )

              // Node radius based on touches: between 2.2 and 4.2
              const r = Math.min(4.2, Math.max(2.4, (node.touches / 80) * 3.8))

              return (
                <g
                  key={node.id}
                  className="cursor-pointer transition-transform duration-150"
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
                  {/* Outer pulse if hovered */}
                  {isHovered && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r + 2.5}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="0.8"
                      strokeDasharray="2,2"
                      className="animate-spin"
                    />
                  )}

                  {/* Player Node Circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={isHovered ? '#38bdf8' : '#0f172a'}
                    stroke={isHovered ? '#ffffff' : '#38bdf8'}
                    strokeWidth="1.2"
                    opacity={isConnected ? 1 : 0.3}
                    className="shadow-lg transition-colors"
                  />

                  {/* Shirt Number */}
                  <text
                    x={node.x}
                    y={node.y + 0.9}
                    textAnchor="middle"
                    fill={isHovered ? '#0f172a' : '#ffffff'}
                    fontSize="2.4"
                    fontWeight="bold"
                    pointerEvents="none"
                    opacity={isConnected ? 1 : 0.3}
                  >
                    {node.shirtNumber ?? '·'}
                  </text>

                  {/* Player Name Label */}
                  <text
                    x={node.x}
                    y={node.y + r + 3.2}
                    textAnchor="middle"
                    fill={isHovered ? '#38bdf8' : '#e2e8f0'}
                    fontSize="2.2"
                    fontWeight="bold"
                    pointerEvents="none"
                    opacity={isConnected ? 1 : 0.3}
                  >
                    {node.shortName}
                  </text>
                </g>
              )
            })}
          </svg>
        </PitchCanvas>

        {/* Hovered Player Tooltip Card */}
        {hoveredNode && (
          <div className="absolute top-3 right-3 bg-slate-900/95 border border-sky-500/40 text-slate-100 p-3 rounded-xl shadow-2xl backdrop-blur-md pointer-events-none text-xs space-y-1 animate-in fade-in">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-1.5 font-bold">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono">
                {hoveredNode.shirtNumber}
              </span>
              <span>{hoveredNode.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-[11px]">
              <span className="text-slate-400">Position:</span>
              <span className="font-semibold">{hoveredNode.position}</span>
              <span className="text-slate-400">{t('networkInvolvements')}</span>
              <span className="font-semibold text-sky-400">{hoveredNode.touches}</span>
              <span className="text-slate-400">Key Links:</span>
              <span className="font-semibold">
                {activeLinks.filter((l) => l.source === hoveredNode.id || l.target === hoveredNode.id).length} connections
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
