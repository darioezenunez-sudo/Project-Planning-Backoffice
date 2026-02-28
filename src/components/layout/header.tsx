'use client';

import { Bell, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';

export type BreadcrumbEntry = { label: string; href?: string };

type AppHeaderProps = {
  breadcrumbs: BreadcrumbEntry[];
};

function getInitials(email: string): string {
  const part = email.split('@')[0];
  if (part == null || part.length === 0) return 'U';
  if (part.length >= 2) return part.slice(0, 2).toUpperCase();
  return part.slice(0, 1).toUpperCase();
}

export function AppHeader({ breadcrumbs }: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const metadata = user?.user_metadata as { full_name?: string } | undefined;
  const displayName = metadata?.full_name ?? user?.email ?? 'Usuario';
  const initials = user?.email != null ? getInitials(user.email) : 'U';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {item.href != null ? (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label="Notificaciones"
        >
          <Bell className="size-[18px]" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{displayName}</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => void signOut()}>Cerrar sesión</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
