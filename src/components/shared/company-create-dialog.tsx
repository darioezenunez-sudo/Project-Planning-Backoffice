'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCompany } from '@/hooks/use-companies';
import type { CreateCompanyInput } from '@/schemas/company.schema';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CompanyCreateDialog({ open, onOpenChange }: Props) {
  const create = useCreateCompany();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCompanyInput>({
    defaultValues: { name: '', industry: '', description: '', website: '' },
  });

  const onSubmit = async (values: CreateCompanyInput) => {
    try {
      await create.mutateAsync(values);
      reset();
      onOpenChange(false);
    } catch {
      // error shown via create.isError
    }
  };

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva empresa</DialogTitle>
        </DialogHeader>

        <form
          id="company-create-form"
          onSubmit={(e) => {
            void handleSubmit(onSubmit)(e);
          }}
          className="space-y-4 py-2"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="c-name">
              Nombre <span className="text-destructive">*</span>
            </Label>
            <Input
              id="c-name"
              placeholder="Ej: Acme Corp"
              {...register('name', { required: 'El nombre es obligatorio' })}
            />
            {errors.name != null && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Industry */}
          <div className="space-y-1.5">
            <Label htmlFor="c-industry">Industria</Label>
            <Input
              id="c-industry"
              placeholder="Ej: Tecnología, Retail…"
              {...register('industry')}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Descripción</Label>
            <Textarea
              id="c-desc"
              placeholder="Descripción opcional"
              rows={3}
              {...register('description')}
            />
          </div>

          {/* Website */}
          <div className="space-y-1.5">
            <Label htmlFor="c-web">Sitio web</Label>
            <Input id="c-web" placeholder="https://ejemplo.com" {...register('website')} />
            {errors.website != null && (
              <p className="text-xs text-destructive">{errors.website.message}</p>
            )}
          </div>

          {create.isError && (
            <p className="text-sm text-destructive">
              {create.error instanceof Error ? create.error.message : 'Error al crear la empresa.'}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="company-create-form"
            disabled={isSubmitting || create.isPending}
          >
            {isSubmitting || create.isPending ? 'Creando…' : 'Crear empresa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
