'use client';

import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/hooks/use-notifications';
import { useTenant } from '@/hooks/use-tenant';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'notifications_read';

function getReadIds(organizationId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    const ids = parsed[organizationId];
    return Array.isArray(ids) ? new Set(ids) : new Set();
  } catch {
    return new Set();
  }
}

function setReadIds(organizationId: string, ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = (raw ? JSON.parse(raw) : {}) as Record<string, string[]>;
    parsed[organizationId] = Array.from(ids);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

export function NotificationBell({ className }: { className?: string }) {
  const t = useTranslations('notifications');
  const { organizationId } = useTenant();
  const { notifications, isLoading, refetch } = useNotifications();
  const [readIds, setReadIdsState] = React.useState<Set<string>>(() =>
    organizationId ? getReadIds(organizationId) : new Set(),
  );

  React.useEffect(() => {
    if (organizationId) setReadIdsState(getReadIds(organizationId));
  }, [organizationId]);

  const unread = React.useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)),
    [notifications, readIds],
  );
  const unreadCount = unread.length;

  const markOneAsRead = React.useCallback(
    (id: string) => {
      if (!organizationId) return;
      const next = new Set(readIds);
      next.add(id);
      setReadIdsState(next);
      setReadIds(organizationId, next);
    },
    [organizationId, readIds],
  );

  const markAllAsRead = React.useCallback(() => {
    if (!organizationId) return;
    const next = new Set(notifications.map((n) => n.id));
    setReadIdsState(next);
    setReadIds(organizationId, next);
  }, [organizationId, notifications]);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void refetch();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative text-muted-foreground', className)}
          aria-label={t('ariaLabel')}
        >
          <Bell className="size-[18px]" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground"
              aria-hidden
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between border-b px-2 py-1.5">
          <span className="text-sm font-medium">{t('title')}</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
              {t('markAllRead')}
            </Button>
          )}
        </div>
        {isLoading && (
          <div className="py-6 text-center text-sm text-muted-foreground">{t('loading')}</div>
        )}
        {!isLoading && notifications.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</div>
        )}
        {!isLoading && notifications.length > 0 && (
          <div className="max-h-[320px] overflow-y-auto">
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex cursor-default flex-col items-start gap-0.5 py-2"
                onSelect={(e) => {
                  e.preventDefault();
                  markOneAsRead(n.id);
                }}
              >
                <span className="text-sm">{n.message}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
