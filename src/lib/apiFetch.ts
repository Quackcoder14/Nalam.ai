/**
 * Client-side fetch wrapper that ensures:
 * 1. `credentials: 'include'` so the browser always sends the HttpOnly
 *    `nalam_token` JWT cookie with every request.
 * 2. A default `Content-Type: application/json` header.
 * 3. Sends the JWT token as an Authorization Bearer header as a fallback
 *    (in case the HttpOnly cookie isn't sent in some dev/browser environments).
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers ?? {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Fallback: also send the token as a Bearer header if stored in sessionStorage
  const token = sessionStorage.getItem('nalamToken');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers, credentials: 'include' });
}
