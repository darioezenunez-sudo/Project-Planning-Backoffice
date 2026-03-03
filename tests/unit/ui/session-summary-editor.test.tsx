import { render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SessionDetailContent } from '@/components/screens/sessions/session-detail-content';

import { AllProviders } from './test-utils';

const mockUseSession = vi.fn();
const mockUseSummaryBySession = vi.fn();
const mockUseUpdateSummary = vi.fn();
const mockUseEchelon = vi.fn();

vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      placeholder={placeholder}
    />
  ),
}));

vi.mock('@/hooks/use-sessions', () => ({
  useSession: (id: string | null) => mockUseSession(id) as unknown,
}));
vi.mock('@/hooks/use-summaries', () => ({
  useSummaryBySession: (id: string | null) => mockUseSummaryBySession(id) as unknown,
  useUpdateSummary: () => ({
    mutate: mockUseUpdateSummary,
    isPending: false,
  }),
}));
vi.mock('@/hooks/use-echelons', () => ({
  useEchelon: (id: string | null) => mockUseEchelon(id) as unknown,
}));

function renderSessionDetail(sessionId: string) {
  return render(
    <AllProviders>
      <SessionDetailContent sessionId={sessionId} />
    </AllProviders>,
  );
}

describe('SessionDetailContent', () => {
  it('renders error state when session fails to load', () => {
    mockUseSession.mockReturnValue({
      isError: true,
      error: new Error('Session not found'),
      data: null,
    });
    mockUseSummaryBySession.mockReturnValue({ data: undefined });
    mockUseEchelon.mockReturnValue({ data: undefined });

    const { container } = renderSessionDetail('sess-1');
    expect(within(container).getByText(/session not found/i)).toBeInTheDocument();
  });

  it('renders loading skeletons when session is loading', () => {
    mockUseSession.mockReturnValue({ isLoading: true, data: null });
    mockUseSummaryBySession.mockReturnValue({ data: undefined });
    mockUseEchelon.mockReturnValue({ data: undefined });

    const { container } = renderSessionDetail('sess-1');
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders session summary with Original IA and Editar tabs when data is loaded', () => {
    mockUseSession.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 'sess-1',
        echelonId: 'ech-1',
        sessionNumber: 3,
        createdAt: '2026-02-20T00:00:00Z',
        updatedAt: '2026-02-20T00:00:00Z',
        version: 1,
        organizationId: 'org1',
        deletedAt: null,
      },
    });
    mockUseSummaryBySession.mockReturnValue({
      isLoading: false,
      data: {
        id: 'sum-1',
        rawContent: '## Resumen\nContenido generado por IA.',
        editedContent: null,
        state: 'DRAFT',
        version: 1,
        createdAt: '2026-02-25T14:32:00Z',
      },
    });
    mockUseEchelon.mockReturnValue({
      data: { id: 'ech-1', name: 'Fase de Levantamiento' },
    });

    const { container } = renderSessionDetail('sess-1');

    expect(
      within(container).getByRole('heading', { name: /summary — sesión #3/i }),
    ).toBeInTheDocument();
    expect(within(container).getByRole('tab', { name: /original ia/i })).toBeInTheDocument();
    expect(within(container).getByRole('tab', { name: /editar/i })).toBeInTheDocument();
    expect(within(container).getByText(/contenido generado por ia/i)).toBeInTheDocument();
  });

  it('calls updateSummary.mutate when Guardar cambios is clicked', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: 'sess-1',
        echelonId: 'ech-1',
        sessionNumber: 1,
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: '2026-02-01T00:00:00Z',
        version: 1,
        organizationId: 'org1',
        deletedAt: null,
      },
    });
    mockUseSummaryBySession.mockReturnValue({
      isLoading: false,
      data: {
        id: 'sum-1',
        rawContent: 'Original',
        editedContent: 'Original',
        state: 'DRAFT',
        version: 1,
        createdAt: '2026-02-01T00:00:00Z',
      },
    });
    mockUseEchelon.mockReturnValue({
      data: { id: 'ech-1', name: 'Echelon' },
    });

    const { container } = renderSessionDetail('sess-1');

    const textarea = within(container).getByPlaceholderText(/escribí o pegá el resumen/i);
    await user.clear(textarea);
    await user.type(textarea, 'Texto editado');
    const saveButton = within(container).getByRole('button', { name: /guardar cambios/i });
    await user.click(saveButton);

    expect(mockUseUpdateSummary).toHaveBeenCalled();
    const [firstArg] = mockUseUpdateSummary.mock.calls[0] as [
      { editedContent: string; version: number },
      { onSuccess?: () => void },
    ];
    expect(firstArg.version).toBe(1);
    expect(firstArg.editedContent).toContain('Texto editado');
  });
});
