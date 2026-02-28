import type { User } from '@supabase/supabase-js';
import { create } from 'zustand';

export type AuthMembership = {
  organizationId: string;
  role: string;
  organizationName: string;
};

type AuthState = {
  user: User | null;
  /** Active organization for the current session (first membership by default). */
  organizationId: string | null;
  organizationName: string | null;
  role: string | null;
  memberships: AuthMembership[];
  isInitialized: boolean;

  setUser: (user: User | null) => void;
  setMemberships: (memberships: AuthMembership[]) => void;
  setActiveOrg: (organizationId: string) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  organizationId: null,
  organizationName: null,
  role: null,
  memberships: [],
  isInitialized: false,

  setUser: (user) => {
    set({ user });
  },

  setMemberships: (memberships) => {
    const first = memberships[0];
    set({
      memberships,
      organizationId: first?.organizationId ?? null,
      organizationName: first?.organizationName ?? null,
      role: first?.role ?? null,
      isInitialized: true,
    });
  },

  setActiveOrg: (organizationId) => {
    const membership = get().memberships.find((m) => m.organizationId === organizationId);
    if (membership) {
      set({
        organizationId: membership.organizationId,
        organizationName: membership.organizationName,
        role: membership.role,
      });
    }
  },

  reset: () => {
    set({
      user: null,
      organizationId: null,
      organizationName: null,
      role: null,
      memberships: [],
      isInitialized: false,
    });
  },
}));
