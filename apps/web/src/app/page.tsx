import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import { Container } from '@/components/ui/grid'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { PlatformOverview } from '@/components/home/PlatformOverview'
import stadium from '@/assets/brand/stadium.webp'

export default function Home() {
  const t = useTranslations('Home')
  return (
    <div className="flex flex-col gap-12 pb-12 lg:pb-16">
      <section className="pt-10 sm:pt-16 lg:pt-20">
        <Container className="flex flex-col items-center text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary sm:mb-7">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary motion-safe:animate-pulse" />
            {t('live')}
          </div>
          <h1 className="mb-4 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            {t('hero')} <br className="hidden sm:block" />
            <span className="text-primary">{t('heroBrand')}</span>
          </h1>
          <p className="mb-7 max-w-2xl text-base text-muted-foreground sm:text-xl">
            {t('description')}
          </p>
          <Button asChild size="lg" className="h-12 gap-2 px-8 text-base">
            <Link href="/matches">
              {t('start')} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <div className="relative mt-8 aspect-[16/10] w-full max-w-6xl overflow-hidden rounded-xl border bg-muted sm:mt-10 sm:aspect-[3/1]">
            <Image
              src={stadium}
              alt=""
              fill
              preload
              unoptimized
              className="object-cover object-[center_64%]"
            />
          </div>
        </Container>
      </section>
      <PlatformOverview />
    </div>
  )
}
