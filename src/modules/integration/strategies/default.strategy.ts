import type { EchelonRow } from '@/modules/echelon/echelon.repository';
import type { JobService } from '@/modules/job/job.service';

import type { IntegrationStrategy } from './integration.strategy';

export function createDefaultStrategy(jobService: JobService): IntegrationStrategy {
  return async (echelon: EchelonRow) => {
    const payload = {
      echelonId: echelon.id,
      organizationId: echelon.organizationId,
      echelonName: echelon.name,
    };

    const pdfResult = await jobService.enqueue('PDF', payload);
    if (!pdfResult.ok) return { ok: false, error: pdfResult.error };

    const emailResult = await jobService.enqueue('EMAIL', payload);
    if (!emailResult.ok) return { ok: false, error: emailResult.error };

    return { ok: true };
  };
}
