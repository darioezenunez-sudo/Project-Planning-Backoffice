import { logger } from '../logger';
import { prisma } from '../prisma';

export interface Container {
  prisma: typeof prisma;
  logger: typeof logger;
}

let containerInstance: Container | null = null;

export function getContainer(): Container {
  if (!containerInstance) {
    containerInstance = {
      prisma,
      logger,
    };
  }
  return containerInstance;
}
