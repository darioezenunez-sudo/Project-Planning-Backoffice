'use client';

import { AlertCircle } from 'lucide-react';
import * as React from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type ErrorAlertProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorAlert({ message, onRetry, retryLabel = 'Reintentar' }: ErrorAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{message}</span>
        {onRetry != null && (
          <Button variant="outline" size="sm" onClick={onRetry} className="w-fit">
            {retryLabel}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
