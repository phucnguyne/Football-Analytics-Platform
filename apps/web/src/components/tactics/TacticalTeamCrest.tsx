import Image from 'next/image'

export function TacticalTeamCrest({ src, name }: { src: string; name: string }) {
  return (
    <Image
      src={src}
      alt={name}
      width={24}
      height={24}
      unoptimized={!src.startsWith('https://crests.football-data.org/')}
      className="h-6 w-6 object-contain"
    />
  )
}
