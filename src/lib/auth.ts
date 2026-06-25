import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'nalam-dev-secret-CHANGE-IN-PRODUCTION';

export type NalamRole = 'patient' | 'clinician' | 'hdesk';

export interface SessionPayload {
  sub: string;          // username / email
  role: NalamRole;
  staffId: string;      // for desk: their email; for clinician: their doctor ID
  branch?: string;      // for hdesk: hospital name
  clinicianRole?: string; // 'specialist' | 'emergency' | 'research'
  iat?: number;
  exp?: number;
}

/* ── Parse cookies from the raw Cookie header ─────────────────────────── */
function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), decodeURIComponent(v.join('='))];
    })
  );
}

/* ── Verify the JWT from the HttpOnly cookie ──────────────────────────── */
export function getSessionFromRequest(request: Request): SessionPayload | null {
  // Primary: read from the standard Cookie request header
  const cookies = parseCookies(request.headers.get('cookie'));
  let token = cookies['nalam_token'];

  // Fallback: also check Authorization header (Bearer <token>) for API clients
  if (!token) {
    const auth = request.headers.get('authorization') ?? '';
    if (auth.startsWith('Bearer ')) token = auth.slice(7);
  }

  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

/* ── Assert the caller has one of the allowed roles ───────────────────── */
export function requireRole(
  request: Request,
  allowed: NalamRole[]
): { ok: true; session: SessionPayload } | { ok: false; response: Response } {
  const session = getSessionFromRequest(request);
  if (!session || !allowed.includes(session.role)) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: `Forbidden: insufficient role or missing session (role was ${session?.role || 'none'})` }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }
  return { ok: true, session };
}

/* ── Backward-compat helper used by GET-only routes ──────────────────── */
export function getRoleFromRequest(request: Request): NalamRole | null {
  return getSessionFromRequest(request)?.role ?? null;
}

/** @deprecated use getRoleFromRequest */
export const getRoleFromHeader = getRoleFromRequest;

/* ── Sign a JWT and return a Set-Cookie string (legacy helper) ────────── */
export function signSessionCookie(payload: Omit<SessionPayload, 'iat' | 'exp'>): string {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `nalam_token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`;
}

/* ── Cookie that expires immediately (logout) ────────────────────────── */
export function clearSessionCookie(): string {
  return 'nalam_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
}
