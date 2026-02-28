import { redirect } from 'next/navigation';

/**
 * Root page — the middleware redirects to /login (unauthenticated) or /dashboard
 * (authenticated) before this component renders. This redirect is a server-side
 * fallback for edge cases where the middleware might not intercept the request.
 */
export default function RootPage() {
  redirect('/login');
}
