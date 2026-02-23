import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="mb-4 text-2xl font-bold">Project Planning Backoffice</h1>
      <p className="mb-6 text-neutral-600 dark:text-neutral-400">Control Plane — MVP</p>
      <nav className="flex gap-4">
        <Link href="/login" className="text-blue-600 hover:underline">
          Login
        </Link>
        <Link href="/api/v1/health" className="text-blue-600 hover:underline">
          Health API
        </Link>
      </nav>
    </main>
  );
}
