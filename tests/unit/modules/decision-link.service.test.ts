import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { AppError } from '@/lib/errors/app-error';
import type { DecisionLinkRow } from '@/modules/decision-link/decision-link.repository';
import { createDecisionLinkService } from '@/modules/decision-link/decision-link.service';

const ORG_ID = 'org-11111111-1111-1111-1111-111111111111';
const LINK_ID = 'lnk-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const RF_ID = 'rf-11111111-1111-1111-1111-111111111111';
const ES_ID = 'es-22222222-2222-2222-2222-222222222222';

const fakeLink: DecisionLinkRow = {
  id: LINK_ID,
  organizationId: ORG_ID,
  requiredFieldId: RF_ID,
  executiveSummaryId: ES_ID,
  label: 'Test decision link',
  linkUrl: null,
  linkType: null,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockRepo = {
  findById: vi.fn(),
  findManyByRequiredField: vi.fn(),
  findManyByExecutiveSummary: vi.fn(),
  findManyForEchelon: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
};

describe('DecisionLinkService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listByRequiredField', () => {
    it('returns ok with links from the repository', async () => {
      mockRepo.findManyByRequiredField.mockResolvedValue([fakeLink]);
      const service = createDecisionLinkService(mockRepo);

      const result = await service.listByRequiredField(RF_ID, ORG_ID);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual([fakeLink]);
      expect(mockRepo.findManyByRequiredField).toHaveBeenCalledWith(RF_ID, ORG_ID);
    });

    it('returns ok with empty array when no links exist', async () => {
      mockRepo.findManyByRequiredField.mockResolvedValue([]);
      const service = createDecisionLinkService(mockRepo);

      const result = await service.listByRequiredField(RF_ID, ORG_ID);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual([]);
    });
  });

  describe('listByExecutiveSummary', () => {
    it('returns ok with links from the repository', async () => {
      mockRepo.findManyByExecutiveSummary.mockResolvedValue([fakeLink]);
      const service = createDecisionLinkService(mockRepo);

      const result = await service.listByExecutiveSummary(ES_ID, ORG_ID);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toEqual([fakeLink]);
      expect(mockRepo.findManyByExecutiveSummary).toHaveBeenCalledWith(ES_ID, ORG_ID);
    });
  });

  describe('getById', () => {
    it('returns ok with the link when found', async () => {
      mockRepo.findById.mockResolvedValue(fakeLink);
      const service = createDecisionLinkService(mockRepo);

      const result = await service.getById(LINK_ID, ORG_ID);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(fakeLink);
    });

    it('returns NOT_FOUND when the link does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);
      const service = createDecisionLinkService(mockRepo);

      const result = await service.getById(LINK_ID, ORG_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const error = result.error as AppError;
        expect(error.httpStatus).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('create', () => {
    it('returns ok with the created link', async () => {
      mockRepo.create.mockResolvedValue(fakeLink);
      const service = createDecisionLinkService(mockRepo);

      const input = {
        label: 'Test decision link',
        requiredFieldId: RF_ID,
        executiveSummaryId: ES_ID,
      };
      const result = await service.create(ORG_ID, input);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(fakeLink);
      expect(mockRepo.create).toHaveBeenCalledWith(ORG_ID, input);
    });
  });

  describe('update', () => {
    it('returns ok with the updated link when found and no conflict', async () => {
      const updated: DecisionLinkRow = { ...fakeLink, label: 'Updated label', version: 2 };
      mockRepo.findById.mockResolvedValue(fakeLink);
      mockRepo.update.mockResolvedValue(updated);
      const service = createDecisionLinkService(mockRepo);

      const result = await service.update(LINK_ID, ORG_ID, { label: 'Updated label', version: 1 });

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.label).toBe('Updated label');
    });

    it('returns NOT_FOUND when the link does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);
      const service = createDecisionLinkService(mockRepo);

      const result = await service.update(LINK_ID, ORG_ID, { version: 1 });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const error = result.error as AppError;
        expect(error.httpStatus).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
      }
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('returns CONFLICT when repo.update returns null (version mismatch)', async () => {
      mockRepo.findById.mockResolvedValue(fakeLink);
      mockRepo.update.mockResolvedValue(null);
      const service = createDecisionLinkService(mockRepo);

      const result = await service.update(LINK_ID, ORG_ID, { version: 99 });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const error = result.error as AppError;
        expect(error.httpStatus).toBe(409);
        expect(error.code).toBe('CONFLICT');
      }
    });
  });

  describe('remove', () => {
    it('returns ok when the link is successfully deleted', async () => {
      mockRepo.findById.mockResolvedValue(fakeLink);
      mockRepo.softDelete.mockResolvedValue(true);
      const service = createDecisionLinkService(mockRepo);

      const result = await service.remove(LINK_ID, ORG_ID, 1);

      expect(result.ok).toBe(true);
      expect(mockRepo.softDelete).toHaveBeenCalledWith(LINK_ID, ORG_ID, 1);
    });

    it('returns NOT_FOUND when the link does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);
      const service = createDecisionLinkService(mockRepo);

      const result = await service.remove(LINK_ID, ORG_ID, 1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const error = result.error as AppError;
        expect(error.httpStatus).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
      }
      expect(mockRepo.softDelete).not.toHaveBeenCalled();
    });

    it('returns CONFLICT when softDelete returns false (version mismatch)', async () => {
      mockRepo.findById.mockResolvedValue(fakeLink);
      mockRepo.softDelete.mockResolvedValue(false);
      const service = createDecisionLinkService(mockRepo);

      const result = await service.remove(LINK_ID, ORG_ID, 99);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const error = result.error as AppError;
        expect(error.httpStatus).toBe(409);
        expect(error.code).toBe('CONFLICT');
      }
    });
  });
});
