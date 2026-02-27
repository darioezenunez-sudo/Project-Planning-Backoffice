'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Edit2, ExternalLink, MoreHorizontal, Package } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompany } from '@/hooks/use-companies';
import { useProducts } from '@/hooks/use-products';
import type { Product } from '@/schemas/product.schema';

function CompanyDetailInner({ companyId }: { companyId: string }) {
  const company = useCompany(companyId);
  const products = useProducts({ companyId, limit: 50 });

  if (company.isError) {
    return (
      <ErrorAlert
        message={company.error?.message ?? 'Error'}
        onRetry={() => {
          void company.refetch();
        }}
      />
    );
  }

  if (company.isLoading || company.data == null) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  const c = company.data;
  const productList = (products.data?.data ?? []) as Product[];
  const displayUrl = c.website != null && c.website !== '' ? new URL(c.website).hostname : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            {c.industry != null && c.industry !== '' && (
              <Badge variant="outline" className="text-sm">
                {c.industry}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
            {displayUrl != null && (
              <>
                <a
                  href={c.website ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                  {displayUrl}
                </a>
                <span>·</span>
              </>
            )}
            <span>Creada el {format(new Date(c.createdAt), 'd MMM yyyy', { locale: es })}</span>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Edit2 className="mr-2 size-3.5" />
          Editar empresa
        </Button>
      </div>

      {c.description != null && c.description !== '' && (
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{c.description}</p>
      )}

      <Tabs defaultValue="productos" className="w-full">
        <TabsList>
          <TabsTrigger value="productos">
            Productos
            <Badge variant="secondary" className="ml-2 rounded-full px-1.5 text-xs">
              {productList.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="informacion">Información</TabsTrigger>
        </TabsList>

        <TabsContent value="productos" className="mt-4">
          <div className="mb-4 flex justify-end">
            <Button size="sm">Agregar producto</Button>
          </div>
          {products.isLoading && <Skeleton className="h-48 w-full" />}
          {!products.isLoading && productList.length === 0 && (
            <Card className="rounded-xl border shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <EmptyState
                  icon={<Package className="size-8 text-muted-foreground/50" />}
                  title="Sin productos"
                  description="Agregá el primer producto de esta empresa."
                  action={<Button size="sm">Agregar producto</Button>}
                />
              </CardContent>
            </Card>
          )}
          {!products.isLoading && productList.length > 0 && (
            <Card className="rounded-xl border shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="w-[100px] text-center">Echelons</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productList.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Link
                            href={`/products/${p.id}`}
                            className="text-sm font-medium underline-offset-4 hover:underline"
                          >
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                          {p.description ?? '—'}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          —
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
                                <Link href={`/products/${p.id}`}>Ver detalle</Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive">
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="informacion" className="mt-4">
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nombre</p>
                  <p className="mt-1 text-sm">{c.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Industria</p>
                  <p className="mt-1 text-sm">{c.industry ?? '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Website</p>
                  <p className="mt-1 text-sm">
                    {c.website != null && c.website !== '' ? (
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {displayUrl ?? c.website}
                      </a>
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fecha de creación</p>
                  <p className="mt-1 text-sm">
                    {format(new Date(c.createdAt), "d 'de' MMMM yyyy", { locale: es })}
                  </p>
                </div>
                {c.description != null && c.description !== '' && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">Descripción</p>
                    <p className="mt-1 text-sm">{c.description}</p>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" className="mt-6">
                Editar empresa
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function CompanyDetailContent({ companyId }: { companyId: string }) {
  return <CompanyDetailInner companyId={companyId} />;
}
