import type messages from '../../messages/en.json'
import type { locales } from './locales'

declare module 'next-intl' {
  interface AppConfig {
    Locale: typeof locales[number]
    Messages: typeof messages
  }
}
