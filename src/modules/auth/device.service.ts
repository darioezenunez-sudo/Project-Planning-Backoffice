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
    // Delimiter | avoids ambiguity when machineId contains underscores
    const accessToken = `device_${machineId}|${orgId}|${String(expiresAt.getTime())}`;

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

  /**
   * Validates a device access token (format: device_${machineId}|${orgId}|${expiresAtMs})
   * and returns userId + organizationId for use by withAuth.
   * Pipe delimiter avoids ambiguity when machineId contains underscores.
   */
  async function resolveToken(
    token: string,
  ): Promise<Result<{ userId: string; organizationId: string }>> {
    if (!token.startsWith('device_')) {
      return err(new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid token'));
    }
    const payload = token.slice(7);
    const parts = payload.split('|');
    if (parts.length !== 3) {
      return err(new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid device token'));
    }
    const [machineId, organizationId, expiresAtStr] = parts;
    const expiresAtMs = Number(expiresAtStr);
    if (!Number.isFinite(expiresAtMs) || !organizationId || !machineId) {
      return err(new AppError(ErrorCode.UNAUTHORIZED, 401, 'Invalid device token'));
    }
    if (Date.now() > expiresAtMs) {
      return err(new AppError(ErrorCode.UNAUTHORIZED, 401, 'Device token expired'));
    }
    const device = await repo.findByMachineIdAndOrg(machineId, organizationId);
    if (device === null) {
      return err(new AppError(ErrorCode.UNAUTHORIZED, 401, 'Device not found'));
    }
    if (device.revokedAt !== null) {
      return err(new AppError(ErrorCode.FORBIDDEN, 403, 'Device has been revoked'));
    }
    return ok({ userId: device.userId, organizationId: device.organizationId });
  }

  return { list, enroll, validate, revoke, getById, resolveToken };
}

export type DeviceService = ReturnType<typeof createDeviceService>;
