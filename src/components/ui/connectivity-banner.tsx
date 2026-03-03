'use client';

import { WifiOff } from 'lucide-react';

import { useOnlineStatus } from '@/hooks/use-online-status';

export function ConnectivityBanner(): React.ReactNode {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 bg-destructive/90 px-4 py-2 text-sm font-medium text-destructive-foreground"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>Sin conexión — los cambios no se guardarán</span>
    </div>
  );
}
