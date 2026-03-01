import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CompaniesListContent } from '@/components/screens/companies/companies-list-content';

import { AllProviders } from './test-utils';

const mockUseCompanies = vi.fn();
vi.mock('@/hooks/use-companies', () => ({
  useCompanies: (params: unknown) => mockUseCompanies(params) as unknown,
  useCreateCompany: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

function renderCompaniesList() {
  return render(
    <AllProviders>
      <CompaniesListContent />
    </AllProviders>,
  );
}

describe('CompaniesListContent', () => {
  it('renders loading state when query is loading', () => {
    mockUseCompanies.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    });
    const { container } = renderCompaniesList();
    expect(within(container).getByRole('heading', { name: /empresas/i })).toBeInTheDocument();
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('renders error state with retry when query fails', () => {
    mockUseCompanies.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      refetch: vi.fn(),
    });
    const { container } = renderCompaniesList();
    expect(within(container).getByText(/network error/i)).toBeInTheDocument();
    expect(within(container).getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('renders empty state when there are no companies', () => {
    mockUseCompanies.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [], meta: { pagination: { hasMore: false, limit: 20 } } },
    });
    const { container } = renderCompaniesList();
    expect(within(container).getByText(/no hay empresas/i)).toBeInTheDocument();
  });

  it('renders table with companies when data is loaded', () => {
    mockUseCompanies.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          {
            id: 'c1',
            name: 'TechCorp SA',
            industry: 'Software',
            createdAt: '2026-01-15T10:00:00Z',
            updatedAt: '2026-01-15T10:00:00Z',
            version: 1,
            organizationId: 'org1',
            description: null,
            website: null,
            deletedAt: null,
          },
        ],
        meta: { pagination: { hasMore: false, limit: 20 } },
      },
    });
    const { container } = renderCompaniesList();
    expect(within(container).getByRole('heading', { name: /empresas/i })).toBeInTheDocument();
    expect(within(container).getByRole('link', { name: /techcorp sa/i })).toBeInTheDocument();
    expect(within(container).getByText(/software/i)).toBeInTheDocument();
  });

  it('updates search input and triggers query with debounced search', async () => {
    const user = userEvent.setup();
    mockUseCompanies.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [], meta: { pagination: { hasMore: false, limit: 20 } } },
    });
    const { container } = renderCompaniesList();
    const searchInput = within(container).getByPlaceholderText(/buscar empresa/i);
    await user.type(searchInput, 'acme');
    expect(searchInput).toHaveValue('acme');
    await waitFor(
      () => {
        expect(mockUseCompanies).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: 'acme', limit: 20 }),
        );
      },
      { timeout: 500 },
    );
  });
});
