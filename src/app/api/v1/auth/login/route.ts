import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/schemas/user.schema';

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Servicio de autenticación no configurado.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido o vacío.' }, { status: 400 });
  }
  if (body === null || body === undefined) {
    return NextResponse.json({ error: 'Cuerpo inválido o vacío.' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const cookieStore = await cookies();

  // Collect session cookies that Supabase sets during signIn so they can be
  // forwarded on the Response (Route Handler cookies() is write-only in Next 15).
  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

  // eslint-disable-next-line @typescript-eslint/no-deprecated -- getAll/setAll is the non-deprecated API; rule fires due to overload ordering in @supabase/ssr type definitions
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        cookiesToSet.forEach((c) => pendingCookies.push(c));
      },
    },
  });

  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json(
      { error: 'Credenciales incorrectas. Verificá tu correo y contraseña.' },
      { status: 401 },
    );
  }

  const session = authData.session;
  const user = authData.user;
  // After signInWithPassword success, session and user are defined (Supabase types)
  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    select: { organizationId: true },
    orderBy: { createdAt: 'asc' },
  });

  const response = NextResponse.json({
    ok: true,
    data: {
      accessToken: session.access_token,
      user: {
        id: user.id,
        organizationId: membership?.organizationId ?? '',
      },
    },
  });

  // Forward Supabase session cookies to the browser.
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });

  return response;
}
