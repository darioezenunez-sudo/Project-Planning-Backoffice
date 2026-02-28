import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';
import type { EnrollDeviceInput } from '@/schemas/device.schema';

import type { DeviceRepository, DeviceRow } from './device.repository';

// ─── Service factory ───────────────────────────────────────────────────────────

export function createDeviceService(repo: DeviceRepository) {
  async function list(organizationId: string): Promise<Result<DeviceRow[]>> {
    const devices = await repo.findByOrg(organizationId);
    return ok(devices);
  }

  async function enroll(
    organizationId: string,
    input: EnrollDeviceInput,
  ): Promise<Result<DeviceRow>> {
    const existing = await repo.findByMachineIdAndOrg(input.machineId, organizationId);
    if (existing !== null) {
      if (existing.revokedAt !== null) {
        return err(
          new AppError(ErrorCode.CONFLICT, 409, 'Device was revoked and cannot be re-enrolled', {
            machineId: input.machineId,
          }),
        );
      }
      return ok(existing);
    }

    const device = await repo.create(organizationId, input.userId, input);
    return ok(device);
  }

  async function validate(
    machineId: string,
    organizationId?: string,
  ): Promise<Result<{ device: DeviceRow; accessToken: string; expiresAt: Date }>> {
    const device =
      organizationId !== undefined
        ? await repo.findByMachineIdAndOrg(machineId, organizationId)
        : await repo.findByMachineId(machineId);

    if (device === null) {
      return err(
        new AppError(ErrorCode.NOT_FOUND, 404, 'Device not found or not authorized', {
          machineId,
        }),
      );
    }
    if (device.revokedAt !== null) {
      return err(new AppError(ErrorCode.FORBIDDEN, 403, 'Device has been revoked', { machineId }));
    }

    const orgId = device.organizationId;
    await repo.updateLastSeenAt(machineId, orgId);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const accessToken = `device_${machineId}_${orgId}_${String(expiresAt.getTime())}`;

    return ok({
      device,
      accessToken,
      expiresAt,
    });
  }

  async function revoke(machineId: string, organizationId: string): Promise<Result<DeviceRow>> {
    const device = await repo.findByMachineIdAndOrg(machineId, organizationId);
    if (device === null) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, 'Device not found', { machineId }));
    }
    const revoked = await repo.revoke(machineId, organizationId);
    if (revoked === null) return err(new AppError(ErrorCode.INTERNAL_ERROR, 500, 'Revoke failed'));
    return ok(revoked);
  }

  async function getById(id: string, organizationId: string): Promise<Result<DeviceRow>> {
    const device = await repo.findById(id, organizationId);
    if (device === null) {
      return err(new AppError(ErrorCode.NOT_FOUND, 404, `Device ${id} not found`));
    }
    return ok(device);
  }

  return { list, enroll, validate, revoke, getById };
}

export type DeviceService = ReturnType<typeof createDeviceService>;
