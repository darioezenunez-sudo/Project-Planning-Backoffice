import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

// next-intl createMiddleware is intentionally NOT used here.
// With localePrefix:'never' it still performs internal URL rewrites
// (e.g. /login → /es/login) that cause Next.js to return 404 because
// the app has no [locale] folder structure. Locale detection is handled
// by createNextIntlPlugin (next.config.ts) + src/i18n/request.ts, which
// falls back to defaultLocale:'es' when no locale header is present.

/** Routes unauthenticated users are allowed to visit (no auth guard). */
const AUTH_PAGES = new Set(['/login', '/register']);

export async function middleware(request: NextRequest) {
  // Step 1: Refresh Supabase session tokens in cookies.
  // updateSession() mutates request.cookies in-place when it refreshes the token,
  // so subsequent reads from request.cookies always have the latest valid token.
  const supabaseResponse =
    process.env.NEXT_PUBLIC_SUPABASE_URL != null
      ? await updateSession(request)
      : NextResponse.next({ request });

  // Step 2: Auth-based routing guards (only when Supabase is configured).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl != null && supabaseAnonKey != null) {
    // Read from request.cookies — updateSession mutates them in-place on refresh,
    // so we always have the latest (valid) access token available here.
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- getAll/setAll is the non-deprecated API; rule fires due to overload ordering in @supabase/ssr type definitions
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        // setAll: token refresh already happened in updateSession; this is a
        // read-only client for auth-checking. Providing setAll satisfies the interface.
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;
    const isAuthPage = AUTH_PAGES.has(pathname);

    // Unauthenticated user accessing any non-auth page → force login.
    if (user == null && !isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Authenticated user accessing login / register → send to dashboard.
    if (user != null && isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // Return the supabaseResponse (pass-through with refreshed session cookies).
  // Locale is determined by src/i18n/request.ts via createNextIntlPlugin — no
  // middleware URL rewriting required.
  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
