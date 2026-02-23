export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <aside className="fixed left-0 top-0 w-56 border-r border-neutral-200 p-4 dark:border-neutral-700">
        <p className="text-sm font-medium text-neutral-500">Sidebar (Fase 0.17)</p>
      </aside>
      <main className="p-6 pl-56">{children}</main>
    </div>
  );
}
