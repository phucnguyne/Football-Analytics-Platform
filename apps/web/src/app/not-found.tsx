import { useTranslations } from 'next-intl'
import Link from 'next/link'

export default function NotFound() {
  const t = useTranslations('Common')
  return (
    <section className="container mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">404</p>
      <h1 className="text-3xl font-bold">{t('notFound')}</h1>
      <p className="text-muted-foreground">
        {t('notFoundDescription')}
      </p>
      <Link
        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90"
        href="/"
      >
        {t('backHome')}
      </Link>
    </section>
  )
}
