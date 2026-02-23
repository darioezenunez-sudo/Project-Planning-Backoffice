/**
 * Re-exports the service-role Supabase client under the "admin" name.
 * The service-role client bypasses RLS and has access to auth.admin.* APIs.
 */
export { createSupabaseServerClient as createSupabaseAdminClient } from './server';
