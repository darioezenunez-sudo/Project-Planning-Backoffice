import type { Prisma } from '@prisma/client';

import { prisma, softDeleteData } from '@/lib/prisma';
import type { EnrollDeviceInput } from '@/schemas/device.schema';

// ─── Types ─────────────────────────────────────────────────────────────────────

const deviceSelect = {
  id: true,
  organizationId: true,
  machineId: true,
  userId: true,
  osInfo: true,
  enrolledAt: true,
  lastSeenAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  version: true,
} satisfies Prisma.DeviceSelect;

export type DeviceRow = Prisma.DeviceGetPayload<{ select: typeof deviceSelect }>;

// ─── Repository factory ────────────────────────────────────────────────────────

export function createDeviceRepository() {
  async function findById(id: string, organizationId: string): Promise<DeviceRow | null> {
    return prisma.device.findFirst({
      where: { id, organizationId },
      select: deviceSelect,
    });
  }

  async function findByMachineId(machineId: string): Promise<DeviceRow | null> {
    return prisma.device.findFirst({
      where: { machineId },
      select: deviceSelect,
    });
  }

  async function findByMachineIdAndOrg(
    machineId: string,
    organizationId: string,
  ): Promise<DeviceRow | null> {
    return prisma.device.findFirst({
      where: { machineId, organizationId },
      select: deviceSelect,
    });
  }

  async function create(
    organizationId: string,
    userId: string,
    input: EnrollDeviceInput,
  ): Promise<DeviceRow> {
    return prisma.device.create({
      data: {
        organizationId,
        userId: input.userId,
        machineId: input.machineId,
        osInfo: (input.osInfo ?? undefined) as Prisma.InputJsonValue,
      },
      select: deviceSelect,
    });
  }

  async function updateLastSeenAt(
    machineId: string,
    organizationId: string,
  ): Promise<DeviceRow | null> {
    const result = await prisma.device.updateMany({
      where: { machineId, organizationId, revokedAt: null },
      data: { lastSeenAt: new Date() },
    });
    if (result.count === 0) return null;
    return findByMachineIdAndOrg(machineId, organizationId);
  }

  async function revoke(machineId: string, organizationId: string): Promise<DeviceRow | null> {
    const result = await prisma.device.updateMany({
      where: { machineId, organizationId },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) return null;
    return findByMachineIdAndOrg(machineId, organizationId);
  }

  async function softDelete(id: string, organizationId: string, version: number): Promise<boolean> {
    const result = await prisma.device.updateMany({
      where: { id, organizationId, version },
      data: softDeleteData(),
    });
    return result.count > 0;
  }

  return {
    findById,
    findByMachineId,
    findByMachineIdAndOrg,
    create,
    updateLastSeenAt,
    revoke,
    softDelete,
  };
}

export type DeviceRepository = ReturnType<typeof createDeviceRepository>;
