import { render, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EchelonDetailContent } from '@/components/screens/echelons/echelon-detail-content';

import { AllProviders } from './test-utils';

const mockUseEchelon = vi.fn();
const mockUseEchelonSessions = vi.fn();
const mockUseEchelonTransition = vi.fn();
const mockUseUpdateEchelon = vi.fn();
const mockUseDeleteEchelon = vi.fn();
const mockUseRequiredFields = vi.fn();
const mockUseUpdateRequiredField = vi.fn();
const mockUseCreateRequiredField = vi.fn();
const mockUseDeleteRequiredField = vi.fn();
const mockUseCreateSession = vi.fn();

vi.mock('@/hooks/use-echelons', () => ({
  useEchelon: (id: string | null) => mockUseEchelon(id) as unknown,
  useEchelonSessions: (id: string | null) => mockUseEchelonSessions(id) as unknown,
  useEchelonTransition: (id: string) => mockUseEchelonTransition(id) as unknown,
  useUpdateEchelon: () => mockUseUpdateEchelon() as unknown,
  useDeleteEchelon: () => mockUseDeleteEchelon() as unknown,
}));
vi.mock('@/hooks/use-required-fields', () => ({
  useRequiredFields: (id: string | null) => mockUseRequiredFields(id) as unknown,
  useUpdateRequiredField: (id: string) => mockUseUpdateRequiredField(id) as unknown,
  useCreateRequiredField: (id: string) => mockUseCreateRequiredField(id) as unknown,
  useDeleteRequiredField: (id: string) => mockUseDeleteRequiredField(id) as unknown,
}));
vi.mock('@/hooks/use-sessions', () => ({
  useSession: vi.fn(),
  useCreateSession: (id: string) => mockUseCreateSession(id) as unknown,
  useDeleteSession: vi.fn(),
}));
vi.mock('@/hooks/use-attachments', () => ({
  useAttachments: () => ({
    data: { data: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useUploadAttachment: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAttachment: () => ({ mutate: vi.fn(), isPending: false }),
}));

function renderEchelonDetail(echelonId: string) {
  return render(
    <AllProviders>
      <EchelonDetailContent echelonId={echelonId} />
    </AllProviders>,
  );
}

describe('EchelonDetailContent', () => {
  beforeEach(() => {
    mockUseEchelonTransition.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseUpdateEchelon.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseDeleteEchelon.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseUpdateRequiredField.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseCreateRequiredField.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseDeleteRequiredField.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseCreateSession.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('renders error state when echelon fails to load', () => {
    mockUseEchelon.mockReturnValue({
      isError: true,
      error: new Error('Not found'),
      refetch: vi.fn(),
    });
    mockUseEchelonSessions.mockReturnValue({ data: { data: [] } });
    mockUseRequiredFields.mockReturnValue({ data: [] });

    const { container } = renderEchelonDetail('ech-1');
    expect(within(container).getByText(/not found/i)).toBeInTheDocument();
    expect(within(container).getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('renders loading skeleton when echelon is loading', () => {
    mockUseEchelon.mockReturnValue({ isLoading: true, data: null });
    mockUseEchelonSessions.mockReturnValue({ data: { data: [] } });
    mockUseRequiredFields.mockReturnValue({ data: [] });

    const { container } = renderEchelonDetail('ech-1');
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders echelon name, state and tabs when data is loaded', () => {
    mockUseEchelon.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 'ech-1',
        name: 'Fase de Levantamiento',
        state: 'IN_PROGRESS',
        productId: 'p1',
        organizationId: 'org1',
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        deletedAt: null,
      },
    });
    mockUseEchelonSessions.mockReturnValue({
      isLoading: false,
      data: { data: [{ id: 's1', createdAt: '2026-02-01T00:00:00Z' }] },
    });
    mockUseRequiredFields.mockReturnValue({
      isLoading: false,
      data: [
        {
          id: 'rf1',
          label: 'Relevamiento de procesos',
          isMet: true,
          echelonId: 'ech-1',
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          deletedAt: null,
        },
      ],
    });

    const { container } = renderEchelonDetail('ech-1');

    expect(
      within(container).getByRole('heading', { name: /fase de levantamiento/i }),
    ).toBeInTheDocument();
    expect(within(container).getByRole('tab', { name: /requerimientos/i })).toBeInTheDocument();
    expect(within(container).getByRole('tab', { name: /sesiones/i })).toBeInTheDocument();
    expect(within(container).getByRole('link', { name: /consolidar/i })).toBeInTheDocument();
  });
});
