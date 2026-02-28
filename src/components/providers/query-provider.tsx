'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

/** TanStack Query provider — Fase 5 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 30s antes de considerar los datos stale (evita refetch en navegación intra-app)
            staleTime: 30_000,
            // No refetch automático al volver a enfocarse en la ventana/pestaña.
            // En un backoffice interno con datos relativamente estables esto evita
            // decenas de requests innecesarios durante el uso normal.
            refetchOnWindowFocus: false,
            // No reintentar peticiones 4xx (auth/permiso): son errores deterministas.
            // Reintentar 1 vez en 5xx (error de servidor transitorio).
            retry: (failureCount, error) => {
              if (error instanceof Error && error.message.includes('40')) return false;
              return failureCount < 1;
            },
            // gcTime default: 5 min (300_000ms) — suficiente para navegación fluida
          },
          mutations: {
            // No reintentar mutaciones fallidas (POST/PATCH/DELETE son no-idempotentes
            // salvo los que ya tienen withIdempotency en el servidor)
            retry: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
