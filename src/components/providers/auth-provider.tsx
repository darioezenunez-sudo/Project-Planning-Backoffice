'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';

type MeResponse = {
  data: {
    userId: string;
    memberships: Array<{
      organizationId: string;
      role: string;
      organizationName: string;
    }>;
  };
};

async function fetchMemberships(): Promise<MeResponse['data'] | null> {
  try {
    const res = await fetch('/api/v1/auth/me');
    if (!res.ok) return null;
    const json = (await res.json()) as MeResponse;
    return json.data;
  } catch {
    return null;
  }
}

/**
 * AuthProvider — initializes the auth store on mount.
 *
 * Relies exclusively on onAuthStateChange. The INITIAL_SESSION event fires
 * synchronously on subscription with the current session state, which covers
 * both fresh logins and page refreshes without a second getUser() round-trip.
 *
 * Event flow:
 *   INITIAL_SESSION (session)  → setUser + fetchMemberships → store ready
 *   INITIAL_SESSION (no sess)  → mark isInitialized = true (redirect handled by middleware)
 *   SIGNED_IN                  → update store + memberships
 *   SIGNED_OUT / TOKEN_EXPIRED → reset store + redirect to /login
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const setMemberships = useAuthStore((s) => s.setMemberships);
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        void fetchMemberships().then((data) => {
          if (data) {
            setMemberships(data.memberships);
          } else {
            // Autenticado pero /me falló — marcar inicializado con estado vacío
            setMemberships([]);
          }
        });
      } else {
        if (event === 'INITIAL_SESSION') {
          // Sin sesión al cargar la página — el middleware redirige a /login.
          // Solo marcar el store como inicializado para no bloquear la UI.
          useAuthStore.setState({ isInitialized: true });
        } else {
          // SIGNED_OUT / TOKEN_EXPIRED / USER_DELETED → limpiar y redirigir
          reset();
          router.push('/login');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setMemberships, reset, router]);

  return <>{children}</>;
}
