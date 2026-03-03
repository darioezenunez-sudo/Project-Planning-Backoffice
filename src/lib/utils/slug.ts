/**
 * Derives a URL-safe slug from a display name.
 * Lowercase, replace spaces/special with hyphens, collapse multiple hyphens.
 * Max 60 chars to match organization slug schema.
 */
export function slugFromName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const truncated = base.slice(0, 60);
  if (truncated.length >= 2) return truncated;
  if (base.length >= 2) return base;
  return 'org';
}
