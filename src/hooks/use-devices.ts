'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DeviceResponse } from '@/schemas/device.schema';

import { useTenant } from './use-tenant';

type DevicesListResponse = { data: DeviceResponse[] };

export const deviceKeys = {
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
    enabled: !!organizationId,
  });
}

/**
 * DELETE /api/v1/auth/devices/[machineId] — revoke device (admin only).
 */
export function useRevokeDevice() {
  const { organizationId } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (machineId: string) => {
      const res = await fetch(`/api/v1/auth/devices/${encodeURIComponent(machineId)}`, {
        method: 'DELETE',
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deviceKeys.all });
    },
  });
}
