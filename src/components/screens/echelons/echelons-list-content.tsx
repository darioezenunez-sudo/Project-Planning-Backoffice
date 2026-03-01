'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MoreHorizontal, Search } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';
import { SkeletonTable } from '@/components/shared/skeleton-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEchelons } from '@/hooks/use-echelons';
import type { EchelonState } from '@/schemas/echelon.schema';

// ─── Badge style per state ────────────────────────────────────────────────────

const stateBadgeClass: Record<string, string> = {
  OPEN: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  CLOSING: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  CLOSURE_REVIEW: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  CLOSED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

const stateLabel: Record<string, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En progreso',
  CLOSING: 'Cerrando',
  CLOSURE_REVIEW: 'Revisión',
  CLOSED: 'Cerrado',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type EchelonRow = {
  id: string;
  name?: string;
  state?: string;
  productId?: string;
  product?: { name?: string };
  createdAt?: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function EchelonsListContent() {
  const t = useTranslations('echelons');
  const tCommon = useTranslations('common');

  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [stateFilter, setStateFilter] = React.useState<EchelonState | 'ALL'>('ALL');

  // Debounce the search input
  React.useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const query = useEchelons({
    limit: 20,
    ...(stateFilter !== 'ALL' ? { state: stateFilter } : {}),
  });

  const items = (query.data?.data ?? []) as EchelonRow[];
  const meta = query.data?.meta as
    | { pagination?: { hasMore?: boolean; limit?: number } }
    | undefined;

  // Client-side filter by search term
  const filtered = search
    ? items.filter((e) => (e.name ?? '').toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select
          value={stateFilter}
          onValueChange={(v) => setStateFilter(v as EchelonState | 'ALL')}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            <SelectItem value="OPEN">Abierto</SelectItem>
            <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
            <SelectItem value="CLOSING">Cerrando</SelectItem>
            <SelectItem value="CLOSURE_REVIEW">Revisión</SelectItem>
            <SelectItem value="CLOSED">Cerrado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error */}
      {query.isError && (
        <ErrorAlert
          message={query.error?.message ?? tCommon('error')}
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}

      {/* Loading */}
      {query.isLoading && (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-0">
            <SkeletonTable rows={5} columns={5} />
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!query.isLoading && !query.isError && (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title={t('listEmpty')}
                  description="Los echelons aparecerán aquí cuando sean creados desde la app."
                />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('colName')}</TableHead>
                      <TableHead className="w-[160px]">{t('colState')}</TableHead>
                      <TableHead className="w-[180px]">{t('colProduct')}</TableHead>
                      <TableHead className="w-[130px]">{t('colCreated')}</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((e) => (
                      <TableRow key={e.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Link
                            href={`/echelons/${e.id}`}
                            className="text-sm font-medium underline-offset-4 hover:underline"
                          >
                            {e.name ?? e.id}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {e.state != null && (
                            <Badge variant="outline" className={stateBadgeClass[e.state] ?? ''}>
                              {stateLabel[e.state] ?? e.state}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {e.product?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {e.createdAt != null
                            ? format(new Date(e.createdAt), 'd MMM yyyy', { locale: es })
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/echelons/${e.id}`}>Ver detalle</Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex items-center justify-between px-4 pb-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {filtered.length} echelons
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled>
                      ← Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={meta?.pagination?.hasMore !== true}
                    >
                      Siguiente →
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
