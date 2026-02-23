import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    return updateSession(request);
  }
  return NextResponse.next({ request });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
