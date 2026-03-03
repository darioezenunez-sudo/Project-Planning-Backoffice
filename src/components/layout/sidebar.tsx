'use client';

import {
  BarChart3,
  Building2,
  ChevronLeft,
  ClipboardList,
  Layers,
  LayoutDashboard,
  Monitor,
  Settings,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { navItems, type NavItem } from '@/components/layout/nav-items';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useOrganization } from '@/hooks/use-organization';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebar-store';

const iconMap: Record<NavItem['icon'], React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Building2,
  Layers,
  Monitor,
  BarChart3,
  ClipboardList,
  Users,
  Settings,
};

export function AppSidebar() {
  const pathname = usePathname();
  const { name: orgName } = useOrganization();
  const { collapsed, toggle } = useSidebarStore();

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width]',
        collapsed ? 'w-14' : 'w-[240px]',
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Layers className="size-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{orgName}</span>
            <span className="text-xs text-muted-foreground">Backoffice</span>
          </div>
        )}
      </div>
      <Separator />
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Button
              key={item.href}
              variant="ghost"
              className={cn(
                'h-9 w-full justify-start gap-3 text-sm',
                isActive && 'bg-primary/10 text-primary hover:bg-primary/10',
                !isActive && 'text-muted-foreground',
                collapsed && 'justify-center px-0',
              )}
              asChild
            >
              <Link href={item.href} title={collapsed ? item.label : undefined}>
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </Button>
          );
        })}
      </nav>
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'w-full justify-start gap-2 text-muted-foreground',
            collapsed && 'justify-center px-0',
          )}
          onClick={toggle}
        >
          <ChevronLeft className={cn('size-4 shrink-0', collapsed && 'rotate-180')} />
          {!collapsed && <span>Colapsar</span>}
        </Button>
      </div>
    </aside>
  );
}
