/**
 * Client-side fetch wrapper that ensures:
 * 1. `credentials: 'include'` so the browser always sends the HttpOnly
 *    `nalam_token` JWT cookie with every request.
 * 2. A default `Content-Type: application/json` header.
 * 3. Sends the JWT token as an Authorization Bearer header as a fallback
 *    (in case the HttpOnly cookie isn't sent in some dev/browser environments).
 */
const apiCache = new Map<string, { data: any; expiry: number }>();

export function invalidateApiCache(urlPrefix?: string) {
  if (!urlPrefix) {
    apiCache.clear();
  } else {
    for (const key of apiCache.keys()) {
      if (key.startsWith(urlPrefix)) apiCache.delete(key);
    }
  }
}

export async function apiFetch(
  url: string,
  options: RequestInit & { skipCache?: boolean } = {}
): Promise<Response> {
  const isGet = !options.method || options.method === 'GET';
  const { skipCache, ...fetchOptions } = options;

  if (isGet && !skipCache) {
    const cached = apiCache.get(url);
    if (cached && cached.expiry > Date.now()) {
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const headers = new Headers(fetchOptions.headers ?? {});
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Fallback: also send the token as a Bearer header if stored in sessionStorage or localStorage
  const token = sessionStorage.getItem('nalamToken') || localStorage.getItem('nalamToken');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...fetchOptions, headers, credentials: 'include' });

  if (res.ok) {
    if (isGet && !skipCache) {
      const cloned = res.clone();
      try {
        const data = await cloned.json();
        apiCache.set(url, { data, expiry: Date.now() + 120000 }); // 2-minute TTL
      } catch (e) {
        // Ignored if not JSON
      }
    } else if (!isGet) {
      // Auto-invalidate all cache on mutation to ensure fresh data
      invalidateApiCache();
    }
  }

  return res;
}
