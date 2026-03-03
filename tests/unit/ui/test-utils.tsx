import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';

/** Mensajes mínimos para tests que usan useTranslations (auth, common, etc.) */
const defaultMessages = {
  auth: {
    login: 'Iniciar sesión',
    email: 'Correo',
    password: 'Contraseña',
    forgotPassword: '¿Olvidaste tu contraseña?',
    noAccess: 'No tenés acceso, contactá al administrador.',
  },
  common: {
    loading: 'Cargando...',
    error: 'Error',
    retry: 'Reintentar',
    empty: 'No hay datos',
    seeAll: 'Ver todos',
    save: 'Guardar',
    cancel: 'Cancelar',
  },
  companies: {
    title: 'Empresas',
    newCompany: 'Nueva empresa',
    searchPlaceholder: 'Buscar empresa...',
    name: 'Empresa',
    industry: 'Industria',
    products: 'Productos',
    created: 'Creado',
    empty: 'No hay empresas.',
    editCompany: 'Editar empresa',
    deleteCompany: 'Eliminar empresa',
    deleteConfirm: '¿Eliminar «{name}»?',
    delete: 'Eliminar',
    updated: 'Empresa actualizada.',
    deleted: 'Empresa eliminada.',
  },
} as Record<string, Record<string, string>>;

type AllProvidersProps = {
  children: ReactNode;
  messages?: Record<string, Record<string, string>>;
  locale?: string;
};

/** QueryClient para tests: sin retry y staleTime corto para respuestas rápidas */
function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** Envuelve children con QueryClient y next-intl para tests de componentes de pantalla */
export function AllProviders({
  children,
  messages = defaultMessages,
  locale = 'es',
}: AllProvidersProps) {
  const queryClient = makeTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}
