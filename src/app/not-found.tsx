import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <h2 className="text-xl font-semibold">404 — Página no encontrada</h2>
      <Link href="/" className="mt-4 text-blue-600 hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
