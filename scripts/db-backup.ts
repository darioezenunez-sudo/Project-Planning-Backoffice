/**
 * pg_dump to local file. Run: pnpm exec tsx scripts/db-backup.ts [outputPath]
 * Output: JSON with path and size to stdout. Requires DATABASE_URL and pg_dump on PATH.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

function main(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    process.stderr.write('DATABASE_URL is not set\n');
    process.exit(1);
  }
  const outPath =
    process.argv[2] ??
    path.join(process.cwd(), `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const r = spawnSync('pg_dump', [url, '--no-owner', '--no-acl', '-f', outPath], {
    stdio: 'inherit',
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    process.stderr.write(r.stderr || 'pg_dump failed\n');
    process.exit(r.status ?? 1);
  }
  const stat = fs.statSync(outPath);
  const result = { path: outPath, sizeBytes: stat.size };
  process.stdout.write(JSON.stringify(result, null, 2));
}

main();
