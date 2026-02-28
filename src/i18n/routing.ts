import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['es', 'en'],
  defaultLocale: 'es',
  // 'never' prevents the middleware from doing internal URL rewrites like
  // /login → /es/login. The app has no [locale] folder structure, so rewrites
  // cause 404s. Locale is still detected from cookies/Accept-Language headers.
  localePrefix: 'never',
});
