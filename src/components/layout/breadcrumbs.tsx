'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useCompany } from '@/hooks/use-companies';
import { useEchelon } from '@/hooks/use-echelons';
import { useProduct } from '@/hooks/use-products';
import { useSession } from '@/hooks/use-sessions';

export type BreadcrumbEntry = { label: string; href?: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(segment: string): boolean {
  return UUID_RE.test(segment);
}

/** Path segment labels (static). Use i18n in the component. */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'dashboard',
  companies: 'companies',
  products: 'products',
  echelons: 'echelons',
  sessions: 'sessions',
  consolidation: 'consolidation',
  'audit-log': 'auditLog',
  budget: 'budget',
  devices: 'devices',
  members: 'members',
  settings: 'settings',
};

type PathIds = {
  companyId: string | null;
  productId: string | null;
  echelonId: string | null;
  sessionId: string | null;
};

function parsePathIds(segments: string[]): PathIds {
  const ids: PathIds = {
    companyId: null,
    productId: null,
    echelonId: null,
    sessionId: null,
  };
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg || !isUuid(seg)) continue;
    const prev = segments[i - 1];
    if (prev === 'companies') ids.companyId = seg;
    else if (prev === 'products') ids.productId = seg;
    else if (prev === 'echelons') ids.echelonId = seg;
    else if (prev === 'sessions') ids.sessionId = seg;
  }
  return ids;
}

function useResolvedNames(ids: PathIds): {
  companyName: string | null;
  productName: string | null;
  echelonName: string | null;
  sessionLabel: string | null;
} {
  const company = useCompany(ids.companyId);
  const product = useProduct(ids.productId);
  const echelon = useEchelon(ids.echelonId);
  const session = useSession(ids.sessionId);
  let sessionLabel: string | null = null;
  if (session.data != null) {
    const created = (session.data as { createdAt?: string }).createdAt;
    sessionLabel = created != null ? new Date(created).toLocaleDateString() : 'Sesión';
  }
  return {
    companyName: (company.data as { name?: string } | undefined)?.name ?? null,
    productName: (product.data as { name?: string } | undefined)?.name ?? null,
    echelonName: (echelon.data as { name?: string } | undefined)?.name ?? null,
    sessionLabel,
  };
}

function resolveUuidLabel(
  prev: string | undefined,
  names: ReturnType<typeof useResolvedNames>,
  t: (key: string) => string,
): string {
  if (prev === 'companies') return names.companyName ?? t('detail');
  if (prev === 'products') return names.productName ?? t('detail');
  if (prev === 'echelons') return names.echelonName ?? t('detail');
  if (prev === 'sessions') return names.sessionLabel ?? t('detail');
  return t('detail');
}

/**
 * Builds breadcrumb entries from pathname and resolved entity names.
 * Uses nav namespace for segment labels (dashboard, companies, echelons, etc.).
 */
function buildEntries(
  pathname: string,
  names: ReturnType<typeof useResolvedNames>,
  t: (key: string) => string,
): BreadcrumbEntry[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return [{ label: t('dashboard'), href: '/dashboard' }];
  }

  const entries: BreadcrumbEntry[] = [];
  let href = '';

  if (segments[0] !== 'dashboard') {
    entries.push({ label: t('dashboard'), href: '/dashboard' });
  }

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;
    href += `/${segment}`;
    const isLast = i === segments.length - 1;
    const prev = segments[i - 1];
    const label = isUuid(segment)
      ? resolveUuidLabel(prev, names, t)
      : t(SEGMENT_LABELS[segment] ?? segment);

    entries.push(isLast ? { label } : { label, href });
  }

  return entries;
}

/**
 * Dynamic breadcrumbs from current pathname.
 * Resolves company/product/echelon/session names when the path contains UUIDs.
 */
export function Breadcrumbs() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');

  const segments = React.useMemo(() => pathname.split('/').filter(Boolean), [pathname]);
  const ids = React.useMemo(() => parsePathIds(segments), [segments]);
  const names = useResolvedNames(ids);
  const entries = React.useMemo(() => {
    const tr = (k: string) => (k === 'detail' ? tCommon('detail') : t(k));
    return buildEntries(pathname, names, tr);
  }, [pathname, names, t, tCommon]);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {entries.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {item.href != null && (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              )}
              {item.href == null && <BreadcrumbPage>{item.label}</BreadcrumbPage>}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
