import { NextResponse } from 'next/server';

const OLA_API_KEY = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY || '';
const OLA_BASE = 'https://api.olamaps.io';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const { searchParams } = new URL(request.url);

  // Reconstruct the Ola Maps path
  const olaPath = resolvedParams.path.join('/');

  // Build query string, injecting api_key
  const qp = new URLSearchParams(searchParams);
  qp.set('api_key', OLA_API_KEY);

  const targetUrl = `${OLA_BASE}/${olaPath}?${qp.toString()}`;

  try {
    const olaRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Nalam-AI/1.0',
        'Accept': '*/*',
      },
      // 20s timeout via signal
      signal: AbortSignal.timeout(20000),
    });

    const contentType = olaRes.headers.get('content-type') || 'application/json';
    const body = await olaRes.arrayBuffer();

    // If this is a style JSON, sanitise problematic 3D layers
    if (contentType.includes('application/json') && olaPath.includes('style.json')) {
      try {
        const text = new TextDecoder().decode(body);
        const styleJson = JSON.parse(text);

        if (styleJson.layers) {
          styleJson.layers = styleJson.layers.filter(
            (l: any) => l.id !== '3d_model_data' && l['source-layer'] !== '3d_model'
          );
        }

        // Rewrite all source tile URLs and glyph/sprite URLs to go through this proxy
        // so that tile fetches are also CORS-free
        if (styleJson.sources) {
          for (const key of Object.keys(styleJson.sources)) {
            const source = styleJson.sources[key];
            if (source.url && typeof source.url === 'string' && source.url.includes('api.olamaps.io')) {
              source.url = rewriteToProxy(source.url);
            }
            if (Array.isArray(source.tiles)) {
              source.tiles = source.tiles.map((t: string) =>
                t.includes('api.olamaps.io') ? rewriteToProxy(t) : t
              );
            }
          }
        }
        if (styleJson.glyphs && styleJson.glyphs.includes('api.olamaps.io')) {
          styleJson.glyphs = rewriteToProxy(styleJson.glyphs);
        }
        if (styleJson.sprite && typeof styleJson.sprite === 'string' && styleJson.sprite.includes('api.olamaps.io')) {
          styleJson.sprite = rewriteToProxy(styleJson.sprite);
        }

        return new NextResponse(JSON.stringify(styleJson), {
          status: olaRes.status,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch {
        // If JSON parse fails, pass through as-is
      }
    }

    return new NextResponse(body, {
      status: olaRes.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': olaPath.includes('tiles') ? 'public, max-age=3600' : 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    console.error('Ola proxy error:', err?.message);
    return NextResponse.json({ error: 'Proxy error', detail: err?.message }, { status: 502 });
  }
}

/**
 * Rewrite an api.olamaps.io URL to go through our proxy.
 * Strips the api_key from the URL (proxy adds it server-side).
 * Handles both plain URLs and tile template URLs (with {z}/{x}/{y}).
 */
function rewriteToProxy(url: string): string {
  try {
    // Handle tile template strings like https://api.olamaps.io/tiles/.../tile/{z}/{x}/{y}
    // We need to preserve the template placeholders
    const templatePlaceholders: string[] = [];
    const safePath = url.replace(/\{([^}]+)\}/g, (match) => {
      templatePlaceholders.push(match);
      return `__PH${templatePlaceholders.length - 1}__`;
    });

    const parsed = new URL(safePath);
    const qp = new URLSearchParams(parsed.search);
    qp.delete('api_key'); // proxy injects it server-side

    const cleanPath = parsed.pathname.replace(/^\//, '');
    let proxyUrl = `/api/ola-maps/${cleanPath}`;
    if (qp.toString()) proxyUrl += `?${qp.toString()}`;

    // Restore template placeholders
    templatePlaceholders.forEach((ph, i) => {
      proxyUrl = proxyUrl.replace(`__PH${i}__`, ph);
    });

    return proxyUrl;
  } catch {
    return url;
  }
}
