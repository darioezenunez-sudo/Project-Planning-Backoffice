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
 * 1. Subscribes to Supabase session changes (cookie-based browser session).
 * 2. On session → calls /api/v1/auth/me to discover the user's organization.
 * 3. Populates useAuthStore so all hooks can read organizationId.
 * 4. On sign-out → resets the store.
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        void fetchMemberships().then((data) => {
          if (data) {
            setMemberships(data.memberships);
          } else {
            // Signed in but /me failed — mark initialized with empty state
            setMemberships([]);
          }
        });
      } else {
        reset();
        router.push('/login');
      }
    });

    // Eagerly load session on mount (covers page refresh / SSR → CSR handoff)
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
        void fetchMemberships().then((data) => {
          if (data) {
            setMemberships(data.memberships);
          } else {
            setMemberships([]);
          }
        });
      } else {
        // No session — mark initialized so the app doesn't block on loading state
        useAuthStore.setState({ isInitialized: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser, setMemberships, reset, router]);

  return <>{children}</>;
}
