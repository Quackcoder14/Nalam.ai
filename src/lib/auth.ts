/**
 * Lightweight API-level role validation.
 * Clients must send an `x-nalam-role` header matching their localStorage role.
 * This closes the most dangerous open-access attack vectors without requiring
 * a full session-based auth rewrite.
 */

export type NalamRole = 'patient' | 'clinician' | 'hdesk';

/**
 * Extract and return the role from the request header.
 * Returns null if no header is present.
 */
export function getRoleFromHeader(request: Request): NalamRole | null {
  const role = request.headers.get('x-nalam-role');
  if (role === 'patient' || role === 'clinician' || role === 'hdesk') {
    return role;
  }
  return null;
}

/**
 * Assert that the request carries one of the allowed roles.
 * Returns { ok: true } or { ok: false, response } with a 403 Response.
 */
export function requireRole(
  request: Request,
  allowed: NalamRole[]
): { ok: true } | { ok: false; response: Response } {
  const role = getRoleFromHeader(request);
  if (!role || !allowed.includes(role)) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'Forbidden: insufficient role' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }
  return { ok: true };
}
