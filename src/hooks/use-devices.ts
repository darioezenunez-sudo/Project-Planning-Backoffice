'use client';

import { useQuery } from '@tanstack/react-query';

import type { DeviceResponse } from '@/schemas/device.schema';

import { useTenant } from './use-tenant';

type DevicesListResponse = { data: DeviceResponse[] };

const deviceKeys = {
  all: ['devices'] as const,
  list: (orgId: string) => [...deviceKeys.all, 'list', orgId] as const,
};

export function useDevices() {
  const { organizationId } = useTenant();
  return useQuery({
    queryKey: deviceKeys.list(organizationId ?? ''),
    queryFn: async () => {
      const res = await fetch('/api/v1/devices', {
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<DevicesListResponse>;
    },
    staleTime: 30_000,
    enabled: !!organizationId,
  });
}
