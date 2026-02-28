/** Nav items — Fase 5. Icon: Lucide icon name for sidebar. */
export const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' as const },
  { href: '/companies', label: 'Empresas', icon: 'Building2' as const },
  { href: '/echelons', label: 'Echelons', icon: 'Layers' as const },
  { href: '/devices', label: 'Dispositivos', icon: 'Monitor' as const },
  { href: '/budget', label: 'Presupuesto', icon: 'BarChart3' as const },
  { href: '/audit-log', label: 'Auditoría', icon: 'ClipboardList' as const },
  { href: '/settings', label: 'Configuración', icon: 'Settings' as const },
] as const;

export type NavItem = (typeof navItems)[number];
