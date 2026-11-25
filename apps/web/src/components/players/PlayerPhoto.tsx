'use client'

import Image from 'next/image'
import { useState } from 'react'

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

  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-muted ${className}`}>
      <PhotoWithFallback
        key={JSON.stringify([imageSrc, fallbackSrc])}
        imageSrc={imageSrc}
        fallbackSrc={fallbackSrc}
        name={name}
        fallback={fallback}
      />
    </div>
  )
}

function PhotoWithFallback({ imageSrc, fallbackSrc, name, fallback }: {
  imageSrc: string
  fallbackSrc: string
  name: string
  fallback?: string
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  const currentSrc = failedSrc === imageSrc ? fallbackSrc : imageSrc
  if (failedSrc !== fallbackSrc) {
    return (
      <Image
        key={currentSrc}
        src={currentSrc}
        alt={name}
        fill
        // Provider photos can use arbitrary hosts. The fallback route can
        // redirect to Wikimedia or serve a placeholder SVG.
        unoptimized
        className="object-cover"
        onError={() => setFailedSrc(currentSrc)}
      />
    )
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <span className="text-sm font-bold text-muted-foreground" aria-label={`${name} photo unavailable`}>
      {fallback || initials}
    </span>
  )
}
