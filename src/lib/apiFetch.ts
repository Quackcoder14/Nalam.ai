/**
 * Client-side fetch wrapper that automatically attaches the x-nalam-role
 * header from localStorage. This allows API routes to validate the caller's role.
 *
 * Usage:
 *   import { apiFetch } from '@/lib/apiFetch';
 *   const res = await apiFetch('/api/chat', { method: 'POST', ... });
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const role =
    typeof window !== 'undefined'
      ? (localStorage.getItem('nalamRole') ?? '')
      : '';

  const headers = new Headers(options.headers ?? {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (role) {
    headers.set('x-nalam-role', role);
  }

  return fetch(url, { ...options, headers });
}
