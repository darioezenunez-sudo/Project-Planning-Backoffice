'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">Algo salió mal</h2>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded bg-neutral-800 px-4 py-2 text-white hover:bg-neutral-700"
      >
        Reintentar
      </button>
    </div>
  );
}
