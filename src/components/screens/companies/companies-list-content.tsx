'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';

import { CompanyCreateDialog } from '@/components/shared/company-create-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorAlert } from '@/components/shared/error-alert';
import { SkeletonTable } from '@/components/shared/skeleton-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCompanies, useUpdateCompany, useDeleteCompany } from '@/hooks/use-companies';
import type { Company } from '@/schemas/company.schema';

export function CompaniesListContent() {
  const t = useTranslations('companies');
  const tCommon = useTranslations('common');
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [openCreate, setOpenCreate] = React.useState(false);
  const [editCompany, setEditCompany] = React.useState<Company | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editIndustry, setEditIndustry] = React.useState('');
  const [deleteCompany, setDeleteCompany] = React.useState<Company | null>(null);
  const updateCompany = useUpdateCompany();
  const deleteCompanyMutation = useDeleteCompany();

  React.useEffect(() => {
    if (editCompany) {
      setEditName(editCompany.name);
      setEditIndustry(editCompany.industry ?? '');
    }
  }, [editCompany]);

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput);
    }, 300);
    return () => {
      clearTimeout(id);
    };
  }, [searchInput]);

  const query = useCompanies({
    limit: 20,
    ...(search ? { search } : {}),
  });

  const items = (query.data?.data ?? []) as Company[];
  const meta = query.data?.meta as
    | { pagination?: { hasMore?: boolean; limit?: number } }
    | undefined;

  const handleEditSubmit = () => {
    if (!editCompany) return;
    const name = editName.trim();
    if (!name) return;
    updateCompany.mutate(
      {
        id: editCompany.id,
        name,
        industry: editIndustry.trim() || undefined,
        version: editCompany.version,
      },
      {
        onSuccess: () => {
          setEditCompany(null);
          toast.success(t('updated'));
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleDeleteConfirm = () => {
    if (!deleteCompany) return;
    deleteCompanyMutation.mutate(
      { id: deleteCompany.id, version: deleteCompany.version },
      {
        onSuccess: () => {
          setDeleteCompany(null);
          toast.success(t('deleted'));
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <>
      <CompanyCreateDialog open={openCreate} onOpenChange={setOpenCreate} />
      <Dialog open={editCompany != null} onOpenChange={(open) => !open && setEditCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editCompany')}</DialogTitle>
          </DialogHeader>
          {editCompany && (
            <div className="grid gap-2 py-2">
              <Label htmlFor="edit-company-name">{t('name')}</Label>
              <Input
                id="edit-company-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t('name')}
              />
              <Label htmlFor="edit-company-industry">{t('industry')}</Label>
              <Input
                id="edit-company-industry"
                value={editIndustry}
                onChange={(e) => setEditIndustry(e.target.value)}
                placeholder={t('industry')}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCompany(null)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateCompany.isPending}>
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteCompany != null} onOpenChange={(open) => !open && setDeleteCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteCompany')}</DialogTitle>
          </DialogHeader>
          {deleteCompany && (
            <p className="text-sm text-muted-foreground">
              {t('deleteConfirm', { name: deleteCompany.name })}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCompany(null)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteCompanyMutation.isPending}
            >
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="page-title">{t('title')}</h1>
          <Button size="sm" onClick={() => setOpenCreate(true)}>
            <Plus className="mr-2 size-4" />
            {t('newCompany')}
          </Button>
        </div>

        <div className="relative mb-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {query.isError && (
          <ErrorAlert
            message={query.error?.message ?? tCommon('error')}
            onRetry={() => {
              void query.refetch();
            }}
          />
        )}

        {query.isLoading && (
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-0">
              <SkeletonTable rows={5} columns={5} />
            </CardContent>
          </Card>
        )}

        {!query.isLoading && !query.isError && (
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    title={t('empty')}
                    description="Creá la primera empresa para comenzar."
                    action={
                      <Button onClick={() => setOpenCreate(true)}>
                        <Plus className="mr-2 size-4" />
                        {t('newCompany')}
                      </Button>
                    }
                  />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('name')}</TableHead>
                        <TableHead className="w-[150px]">{t('industry')}</TableHead>
                        <TableHead className="w-[100px] text-center">{t('products')}</TableHead>
                        <TableHead className="w-[130px]">{t('created')}</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((c) => (
                        <TableRow key={c.id} className="hover:bg-muted/50">
                          <TableCell>
                            <Link
                              href={`/companies/${c.id}`}
                              className="text-sm font-medium underline-offset-4 hover:underline"
                            >
                              {c.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.industry ?? '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm text-muted-foreground">—</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(c.createdAt), 'd MMM yyyy', { locale: es })}
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
                                  <Link href={`/companies/${c.id}`}>Ver detalle</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditCompany(c)}>
                                  <Pencil className="mr-2 size-4" />
                                  {t('editCompany')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteCompany(c)}
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  {t('delete')}
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
                      Mostrando 1-{items.length} de {items.length} empresas
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
    </>
  );
}
