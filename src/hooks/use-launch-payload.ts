'use client';

import { useMutation } from '@tanstack/react-query';

import { useTenant } from './use-tenant';

export type LaunchPayload = {
  echelonId: string;
  deepLinkUrl: string;
  context: unknown;
};

/**
 * POST /api/v1/echelons/:id/launch — build launch payload (deep link + context) for the Assistant app.
 */
export function useLaunchPayload(echelonId: string) {
  const { organizationId } = useTenant();

  return useMutation({
    mutationFn: async (): Promise<LaunchPayload> => {
      const res = await fetch(`/api/v1/echelons/${echelonId}/launch`, {
        method: 'POST',
        headers: { 'X-Organization-Id': organizationId ?? '' },
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { data: LaunchPayload };
      return json.data;
    },
  });
}
