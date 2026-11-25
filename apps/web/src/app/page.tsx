import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Container } from '@/components/ui/grid'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { PlatformOverview } from '@/components/home/PlatformOverview'

export default function Home() {
  const t = useTranslations('Home')
  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-24 lg:pt-32">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] dark:bg-grid-black/[0.02]" />
        <Container className="relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-8 animate-fade-in">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
            {t('live')}
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl mb-6 max-w-4xl animate-slide-in">
            {t('hero')} <br className="hidden sm:block" />
            <span className="text-gradient">{t('heroBrand')}</span>
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl mb-10 animate-slide-in [animation-delay:150ms]">
            {t('description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 animate-slide-in [animation-delay:300ms]">
            <Link href="/matches">
              <Button size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20 transition-transform hover:scale-105">
                {t('start')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Container>
      </section>

      {/* Decorative line */}
      <div className="w-full flex justify-center overflow-hidden">
        <div className="w-full max-w-7xl h-px line-t opacity-50" />
      </div>

      <PlatformOverview />
    </div>
  )
}
