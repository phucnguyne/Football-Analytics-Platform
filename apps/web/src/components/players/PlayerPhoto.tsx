'use client'

import { useEffect, useState } from 'react'

interface PlayerPhotoProps {
  playerId: number | string
  name: string
  photo?: string | null
  className: string
  fallback?: string
}

export function PlayerPhoto({
  playerId,
  name,
  photo,
  className,
  fallback,
}: PlayerPhotoProps) {
  const fallbackSrc = `/api/persons/${playerId}/photo?name=${encodeURIComponent(name)}`
  const imageSrc = photo || fallbackSrc
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  useEffect(() => {
    setFailedSrc(null)
  }, [imageSrc, fallbackSrc])

  const currentSrc = failedSrc === imageSrc ? fallbackSrc : imageSrc

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-muted ${className}`}>
      {failedSrc !== fallbackSrc ? (
        <img
          src={currentSrc}
          alt={name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailedSrc(currentSrc)}
        />
      ) : (
        <span className="text-sm font-bold text-muted-foreground" aria-label={`${name} photo unavailable`}>
          {fallback || initials}
        </span>
      )}
    </div>
  )
}
