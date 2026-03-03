'use client';

import * as React from 'react';

import { AppHeader } from '@/components/layout/header';
import { AppSidebar } from '@/components/layout/sidebar';
import { RealtimeProvider } from '@/components/providers/realtime-provider';
import { ConnectivityBanner } from '@/components/ui/connectivity-banner';

type DashboardShellProps = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <RealtimeProvider />
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ConnectivityBanner />
        <AppHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
