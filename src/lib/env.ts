import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),
  VERCEL_URL: z.string().optional(),
  // Upstash for Redis (Vercel Marketplace) — injected automatically when store is linked
  // Prefix "UPSTASH_REDIS_REST" was applied on top of Vercel's KV naming convention
  UPSTASH_REDIS_REST_KV_REST_API_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_KV_REST_API_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  CRON_SECRET: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  VERCEL_URL: process.env.VERCEL_URL,
  UPSTASH_REDIS_REST_KV_REST_API_URL: process.env.UPSTASH_REDIS_REST_KV_REST_API_URL,
  UPSTASH_REDIS_REST_KV_REST_API_TOKEN: process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  SENTRY_DSN: process.env.SENTRY_DSN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
});

if (!parsed.success) {
  const msg = `Invalid environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(msg);
  }
  // En dev permitir arrancar sin todas las vars; se validan donde se usan
}

export const env = parsed.success ? parsed.data : ({} as z.infer<typeof envSchema>);
