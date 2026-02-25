import type { IntegrationStrategy } from './integration.strategy';

/** Architecture strategy — stub (Fase 4). Same as default for MVP. */
export function createArchitectureStrategy(
  defaultStrategy: IntegrationStrategy,
): IntegrationStrategy {
  return defaultStrategy;
}
