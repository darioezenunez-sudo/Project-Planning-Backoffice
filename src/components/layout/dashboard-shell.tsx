'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';

import { AppHeader, type BreadcrumbEntry } from '@/components/layout/header';
import { AppSidebar } from '@/components/layout/sidebar';

const segmentLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  companies: 'Empresas',
  products: 'Productos',
  echelons: 'Echelons',
  sessions: 'Sesiones',
  'audit-log': 'Auditoría',
  budget: 'Presupuesto',
  devices: 'Dispositivos',
  settings: 'Configuración',
  consolidation: 'Consolidación',
};

function pathnameToBreadcrumbs(pathname: string): BreadcrumbEntry[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [{ label: 'Dashboard' }];
  const entries: BreadcrumbEntry[] = [];
  let href = '';
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment == null) continue;
    href += `/${segment}`;
    const label = segmentLabels[segment] ?? (i === segments.length - 1 ? 'Detalle' : segment);
    entries.push(i === segments.length - 1 ? { label } : { label, href });
  }
  return entries;
}

type DashboardShellProps = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const breadcrumbs = React.useMemo(() => pathnameToBreadcrumbs(pathname), [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader breadcrumbs={breadcrumbs} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
