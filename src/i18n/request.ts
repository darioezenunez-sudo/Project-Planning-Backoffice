import { getRequestConfig } from 'next-intl/server';

import { routing } from './routing';

type Locale = (typeof routing.locales)[number];
type Messages = Record<string, unknown>;

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale;
  }
  const loaded = (await import(`./messages/${locale}.json`)) as { default: Messages };
  const messages: Messages = loaded.default;
  return { locale, messages };
});
