import Image from 'next/image'
import Link from 'next/link'
import mark from '@/assets/brand/mark.png'
import { cn } from '@/lib/utils'

export function BrandLink({ fullName = false }: { fullName?: boolean }) {
  const size = fullName ? 40 : 32

  return (
    <Link href="/" className={cn(
      'inline-flex shrink-0 items-center gap-2 rounded-md font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
      fullName ? 'text-xl sm:text-2xl' : 'whitespace-nowrap text-lg',
    )}>
      <Image src={mark} alt="" width={size} height={size} className="shrink-0" unoptimized />
      <span className={fullName ? undefined : 'max-[23rem]:sr-only'}>
        {fullName ? 'Football Analytics Pro' : 'FA Pro'}
      </span>
    </Link>
  )
}
