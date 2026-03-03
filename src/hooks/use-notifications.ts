'use client';

import { useQuery } from '@tanstack/react-query';

import { useTenant } from './use-tenant';

export type NotificationItem = {
  id: string;
  type: 'echelon_state' | 'consolidation' | 'member_added' | 'other';
  message: string;
  createdAt: string;
  entityType?: string;
  entityId?: string;
};

type NotificationsResponse = { data: NotificationItem[] };

const notificationsKey = ['notifications'] as const;

export function useNotifications() {
  const { organizationId } = useTenant();

  const query = useQuery({
    queryKey: [...notificationsKey, organizationId ?? ''],
    queryFn: async (): Promise<NotificationItem[]> => {
      const res = await fetch('/api/v1/notifications', {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as NotificationsResponse;
      return Array.isArray(json.data) ? json.data : [];
    },
    enabled: !!organizationId,
    staleTime: 60_000,
  });

  return {
    notifications: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
