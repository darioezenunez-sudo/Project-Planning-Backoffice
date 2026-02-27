'use client';

import { useQuery } from '@tanstack/react-query';

import type { DeviceResponse } from '@/schemas/device.schema';

type DevicesListResponse = { data: DeviceResponse[] };

const deviceKeys = {
  all: ['devices'] as const,
  list: () => [...deviceKeys.all, 'list'] as const,
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function useDevices() {
  return useQuery({
    queryKey: deviceKeys.list(),
    queryFn: () => fetchJson<DevicesListResponse>('/api/v1/auth/devices'),
    staleTime: 30_000,
  });
}
