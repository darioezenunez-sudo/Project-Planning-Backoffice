import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import LoginPage from '@/app/(auth)/login/page';

import { AllProviders } from './test-utils';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

function renderLoginPage() {
  return render(
    <AllProviders>
      <LoginPage />
    </AllProviders>,
  );
}

describe('Login page', () => {
  it('renders login form with email and password fields', () => {
    renderLoginPage();
    expect(screen.getByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  });

  it('shows validation error when submitting empty form', async () => {
    const user = userEvent.setup();
    renderLoginPage();
    const submit = screen.getByRole('button', { name: /ingresar/i });
    await user.click(submit);
    await waitFor(() => {
      const errors = screen.getAllByText(/correo inválido|la contraseña es requerida/i);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('does not call API when email is invalid (client validation)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    renderLoginPage();
    await user.type(screen.getByLabelText(/correo/i), 'invalid');
    await user.type(screen.getByLabelText(/contraseña/i), 'password1');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled();
    });

    vi.unstubAllGlobals();
  });

  it('calls fetch and shows error when API returns error', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Credenciales incorrectas' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    renderLoginPage();
    await user.type(screen.getByLabelText(/correo/i), 'user@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password1');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'user@example.com', password: 'password1' }),
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText(/credenciales incorrectas/i)).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it('disables submit button while submitting', async () => {
    const user = userEvent.setup();
    const resolvers: { resolve?: (value: Response) => void } = {};
    const submitPromise = new Promise<Response>((resolve) => {
      resolvers.resolve = resolve;
    });
    vi.stubGlobal('fetch', vi.fn(() => submitPromise) as unknown as typeof fetch);

    renderLoginPage();
    await user.type(screen.getByLabelText(/correo/i), 'user@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password1');
    const submit = screen.getByRole('button', { name: /ingresar/i });
    await user.click(submit);

    expect(submit).toBeDisabled();
    if (resolvers.resolve) {
      resolvers.resolve(new Response(JSON.stringify({}), { status: 200 }));
    }
    await waitFor(() => {
      expect(submit).not.toBeDisabled();
    });

    vi.unstubAllGlobals();
  });
});
