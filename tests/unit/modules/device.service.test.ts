import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import type { DeviceRepository, DeviceRow } from '@/modules/auth/device.repository';
import { createDeviceService } from '@/modules/auth/device.service';

const ORG_ID = 'org-111';
const USER_ID = 'user-111';
const MACHINE_ID = 'machine-abc';

function makeDevice(overrides: Partial<DeviceRow> = {}): DeviceRow {
  return {
    id: 'dev-111',
    organizationId: ORG_ID,
    machineId: MACHINE_ID,
    userId: USER_ID,
    osInfo: { platform: 'darwin' },
    enrolledAt: new Date(),
    lastSeenAt: null,
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<DeviceRepository> = {}): DeviceRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByOrg: vi.fn().mockResolvedValue([]),
    findByMachineId: vi.fn().mockResolvedValue(null),
    findByMachineIdAndOrg: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(makeDevice()),
    updateLastSeenAt: vi.fn().mockResolvedValue(makeDevice()),
    revoke: vi.fn().mockResolvedValue(makeDevice({ revokedAt: new Date() })),
    softDelete: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('createDeviceService', () => {
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('returns devices for the organization', async () => {
      const devices = [makeDevice(), makeDevice({ id: 'dev-222', machineId: 'machine-xyz' })];
      vi.mocked(repo.findByOrg).mockResolvedValue(devices);

      const service = createDeviceService(repo);
      const result = await service.list(ORG_ID);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toHaveLength(2);
      expect(repo.findByOrg).toHaveBeenCalledWith(ORG_ID);
    });
  });

  describe('enroll', () => {
    it('creates device when not exists', async () => {
      vi.mocked(repo.findByMachineIdAndOrg).mockResolvedValue(null);
      vi.mocked(repo.create).mockResolvedValue(makeDevice());

      const service = createDeviceService(repo);
      const result = await service.enroll(ORG_ID, {
        machineId: MACHINE_ID,
        userId: USER_ID,
        osInfo: { platform: 'darwin' },
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.machineId).toBe(MACHINE_ID);
      expect(repo.create).toHaveBeenCalledWith(ORG_ID, USER_ID, expect.any(Object));
    });

    it('returns existing device when already enrolled and not revoked', async () => {
      const existing = makeDevice();
      vi.mocked(repo.findByMachineIdAndOrg).mockResolvedValue(existing);

      const service = createDeviceService(repo);
      const result = await service.enroll(ORG_ID, {
        machineId: MACHINE_ID,
        userId: USER_ID,
      });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.id).toBe(existing.id);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('returns CONFLICT when device was revoked', async () => {
      vi.mocked(repo.findByMachineIdAndOrg).mockResolvedValue(
        makeDevice({ revokedAt: new Date() }),
      );

      const service = createDeviceService(repo);
      const result = await service.enroll(ORG_ID, {
        machineId: MACHINE_ID,
        userId: USER_ID,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(AppError);
        expect((result.error as AppError).httpStatus).toBe(409);
      }
    });
  });

  describe('validate', () => {
    it('returns NOT_FOUND when device does not exist', async () => {
      vi.mocked(repo.findByMachineId).mockResolvedValue(null);

      const service = createDeviceService(repo);
      const result = await service.validate(MACHINE_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns FORBIDDEN when device is revoked', async () => {
      vi.mocked(repo.findByMachineId).mockResolvedValue(makeDevice({ revokedAt: new Date() }));

      const service = createDeviceService(repo);
      const result = await service.validate(MACHINE_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(403);
    });

    it('returns accessToken and updates lastSeenAt when valid', async () => {
      vi.mocked(repo.findByMachineId).mockResolvedValue(makeDevice());
      vi.mocked(repo.updateLastSeenAt).mockResolvedValue(makeDevice());

      const service = createDeviceService(repo);
      const result = await service.validate(MACHINE_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.accessToken).toBeDefined();
        expect(result.value.expiresAt).toBeInstanceOf(Date);
      }
      expect(repo.updateLastSeenAt).toHaveBeenCalledWith(MACHINE_ID, ORG_ID);
    });
  });

  describe('revoke', () => {
    it('returns NOT_FOUND when device does not exist', async () => {
      vi.mocked(repo.findByMachineIdAndOrg).mockResolvedValue(null);

      const service = createDeviceService(repo);
      const result = await service.revoke(MACHINE_ID, ORG_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) expect((result.error as AppError).httpStatus).toBe(404);
    });

    it('returns revoked device on success', async () => {
      const revoked = makeDevice({ revokedAt: new Date() });
      vi.mocked(repo.findByMachineIdAndOrg).mockResolvedValue(makeDevice());
      vi.mocked(repo.revoke).mockResolvedValue(revoked);

      const service = createDeviceService(repo);
      const result = await service.revoke(MACHINE_ID, ORG_ID);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.revokedAt).not.toBeNull();
    });
  });
});
