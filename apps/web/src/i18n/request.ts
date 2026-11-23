import { cookies } from 'next/headers'
import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { localeCookie, locales } from './locales'

export default getRequestConfig(async () => {
  const requested = (await cookies()).get(localeCookie)?.value
  const locale = hasLocale(locales, requested) ? requested : 'en'
  return {
    locale,
    timeZone: "UTC",
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
