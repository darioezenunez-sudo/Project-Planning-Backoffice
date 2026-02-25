import type { IntegrationStrategy } from './integration.strategy';

/** PM strategy — stub (Fase 4). Same as default for MVP. */
export function createPmStrategy(defaultStrategy: IntegrationStrategy): IntegrationStrategy {
  return defaultStrategy;
}
