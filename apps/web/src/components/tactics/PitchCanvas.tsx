'use client'

import React from 'react'

interface PitchCanvasProps {
  children?: React.ReactNode
  theme?: 'green' | 'tactical-dark'
  className?: string
  showThirds?: boolean
}

export function PitchCanvas({
  children,
  theme = 'tactical-dark',
  className = '',
  showThirds = false,
}: PitchCanvasProps) {
  const isDark = theme === 'tactical-dark'

  return (
    <div
      className={`relative w-full aspect-[1.5/1] rounded-xl overflow-hidden border select-none transition-colors ${
        isDark
          ? 'bg-slate-950/90 border-slate-800 shadow-2xl'
          : 'bg-emerald-800 border-emerald-950/80 shadow-lg'
      } ${className}`}
    >
      {/* Pitch Grass Pattern or Dark Tactical Grid */}
      {isDark ? (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-slate-950 to-black pointer-events-none" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-800 opacity-90 pointer-events-none" />
      )}

      {/* SVG Pitch Markings */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id="tacticalGrid"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 10 0 L 0 0 0 10"
              fill="none"
              stroke={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)'}
              strokeWidth="0.5"
            />
          </pattern>
        </defs>

        {/* Grid pattern */}
        <rect width="100" height="100" fill="url(#tacticalGrid)" />

        {/* Boundary Line */}
        <rect
          x="3"
          y="3"
          width="94"
          height="94"
          fill="none"
          stroke={isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(255, 255, 255, 0.75)'}
          strokeWidth="0.8"
        />

        {/* Halfway Line */}
        <line
          x1="50"
          y1="3"
          x2="50"
          y2="97"
          stroke={isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(255, 255, 255, 0.75)'}
          strokeWidth="0.8"
        />

        {/* Center Circle */}
        <circle
          cx="50"
          cy="50"
          r="10"
          fill="none"
          stroke={isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(255, 255, 255, 0.75)'}
          strokeWidth="0.8"
        />
        <circle
          cx="50"
          cy="50"
          r="0.8"
          fill={isDark ? 'rgba(148, 163, 184, 0.8)' : 'rgba(255, 255, 255, 0.9)'}
        />

        {/* Left Penalty Area */}
        <rect
          x="3"
          y="22"
          width="16"
          height="56"
          fill="none"
          stroke={isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(255, 255, 255, 0.75)'}
          strokeWidth="0.8"
        />
        {/* Left 6-Yard Box */}
        <rect
          x="3"
          y="36"
          width="6"
          height="28"
          fill="none"
          stroke={isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(255, 255, 255, 0.75)'}
          strokeWidth="0.8"
        />
        {/* Left Penalty Spot & Arc */}
        <circle
          cx="14"
          cy="50"
          r="0.8"
          fill={isDark ? 'rgba(148, 163, 184, 0.8)' : 'rgba(255, 255, 255, 0.9)'}
        />
        <path
          d="M 19 43 A 8 8 0 0 1 19 57"
          fill="none"
          stroke={isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(255, 255, 255, 0.75)'}
          strokeWidth="0.8"
        />

        {/* Right Penalty Area */}
        <rect
          x="81"
          y="22"
          width="16"
          height="56"
          fill="none"
          stroke={isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(255, 255, 255, 0.75)'}
          strokeWidth="0.8"
        />
        {/* Right 6-Yard Box */}
        <rect
          x="91"
          y="36"
          width="6"
          height="28"
          fill="none"
          stroke={isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(255, 255, 255, 0.75)'}
          strokeWidth="0.8"
        />
        {/* Right Penalty Spot & Arc */}
        <circle
          cx="86"
          cy="50"
          r="0.8"
          fill={isDark ? 'rgba(148, 163, 184, 0.8)' : 'rgba(255, 255, 255, 0.9)'}
        />
        <path
          d="M 81 43 A 8 8 0 0 0 81 57"
          fill="none"
          stroke={isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(255, 255, 255, 0.75)'}
          strokeWidth="0.8"
        />

        {/* Corner Arcs */}
        <path d="M 3 5 A 2 2 0 0 0 5 3" stroke={isDark ? 'rgba(148,163,184,0.45)' : 'rgba(255,255,255,0.75)'} strokeWidth="0.8" fill="none" />
        <path d="M 3 95 A 2 2 0 0 1 5 97" stroke={isDark ? 'rgba(148,163,184,0.45)' : 'rgba(255,255,255,0.75)'} strokeWidth="0.8" fill="none" />
        <path d="M 97 5 A 2 2 0 0 1 95 3" stroke={isDark ? 'rgba(148,163,184,0.45)' : 'rgba(255,255,255,0.75)'} strokeWidth="0.8" fill="none" />
        <path d="M 97 95 A 2 2 0 0 0 95 97" stroke={isDark ? 'rgba(148,163,184,0.45)' : 'rgba(255,255,255,0.75)'} strokeWidth="0.8" fill="none" />

        {/* Optional Tactical 3rd Guides */}
        {showThirds && (
          <>
            <line
              x1="33.3"
              y1="3"
              x2="33.3"
              y2="97"
              stroke="rgba(56, 189, 248, 0.25)"
              strokeDasharray="2,2"
              strokeWidth="0.6"
            />
            <line
              x1="66.6"
              y1="3"
              x2="66.6"
              y2="97"
              stroke="rgba(56, 189, 248, 0.25)"
              strokeDasharray="2,2"
              strokeWidth="0.6"
            />
            <text x="18" y="9" fill="rgba(148,163,184,0.6)" fontSize="3.2" fontWeight="bold" textAnchor="middle">
              DEFENSIVE 3RD
            </text>
            <text x="50" y="9" fill="rgba(148,163,184,0.6)" fontSize="3.2" fontWeight="bold" textAnchor="middle">
              MIDDLE 3RD
            </text>
            <text x="82" y="9" fill="rgba(148,163,184,0.6)" fontSize="3.2" fontWeight="bold" textAnchor="middle">
              ATTACKING 3RD
            </text>
          </>
        )}
      </svg>

      {/* Attacking Direction Indicator */}
      <div className="absolute bottom-2 left-6 right-6 flex items-center justify-between text-[10px] text-slate-400/80 pointer-events-none font-semibold tracking-wider uppercase">
        <span className="flex items-center gap-1">◀ Own Half</span>
        <span className="flex items-center gap-1">Attacking Direction ▶</span>
      </div>

      {/* Interactive Layer */}
      <div className="absolute inset-0">{children}</div>
    </div>
  )
}

