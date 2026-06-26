'use client';
import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

const OLA_API_KEY = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY || '';
const DEFAULT_CENTER: [number, number] = [80.2512, 13.0604]; // Chennai fallback

interface NearbyPlace {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: 'hospital' | 'pharmacy';
}

async function fetchNearby(lat: number, lng: number, type: 'hospital' | 'pharmacy'): Promise<NearbyPlace[]> {
  try {
    // Step 1: Get nearby place IDs
    const searchUrl = `https://api.olamaps.io/places/v1/nearbysearch?location=${lat},${lng}&radius=5000&types=${type}&api_key=${OLA_API_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    if (searchData.status !== 'ok' || !searchData.predictions) return [];

    // Step 2: Fetch details for each place to get coordinates
    const places = await Promise.all(
      searchData.predictions.slice(0, 6).map(async (p: any) => {
        try {
          const detailUrl = `https://api.olamaps.io/places/v1/details?place_id=${p.place_id}&api_key=${OLA_API_KEY}`;
          const detailRes = await fetch(detailUrl);
          const detailData = await detailRes.json();
          if (detailData.status !== 'ok' || !detailData.result?.geometry?.location) return null;
          return {
            place_id: p.place_id,
            name: detailData.result.name || p.structured_formatting?.main_text || 'Unknown',
            address: p.structured_formatting?.secondary_text || p.description || '',
            lat: detailData.result.geometry.location.lat,
            lng: detailData.result.geometry.location.lng,
            type,
          } as NearbyPlace;
        } catch { return null; }
      })
    );
    return places.filter(Boolean) as NearbyPlace[];
  } catch { return []; }
}

export default function OlaMap({
  height = '380px',
  className = '',
}: {
  height?: string;
  className?: string;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [status, setStatus] = useState<'locating' | 'loading' | 'ready' | 'error'>('locating');
  const [locationLabel, setLocationLabel] = useState('');
  const [filter, setFilter] = useState<'all' | 'hospital' | 'pharmacy'>('all');
  const placesRef = useRef<NearbyPlace[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Get user location
      let userLat = DEFAULT_CENTER[1];
      let userLng = DEFAULT_CENTER[0];

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
        );
        if (cancelled) return;
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        setLocationLabel('Using your location');
      } catch {
        setLocationLabel('Showing Chennai (location unavailable)');
      }

      setStatus('loading');
      if (cancelled) return;

      // 2. Import MapLibre
      const maplibre = await import('maplibre-gl');
      if (cancelled) return;
      const { Map, NavigationControl, Marker, Popup } = maplibre.default || maplibre;

      // 3. Create map with transformRequest to inject api_key into ALL tile requests
      const map = new Map({
        container: mapContainer.current!,
        style: `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${OLA_API_KEY}`,
        center: [userLng, userLat],
        zoom: 14,
        attributionControl: false,
        transformRequest: (url: string, resourceType?: string) => {
          // Inject api_key into every Ola Maps tile / source request
          if (url.includes('api.olamaps.io') && !url.includes('api_key=')) {
            const sep = url.includes('?') ? '&' : '?';
            return { url: `${url}${sep}api_key=${OLA_API_KEY}` };
          }
          return { url };
        },
      });

      map.addControl(new NavigationControl(), 'top-right');
      mapRef.current = map;

      // 4. Add user location marker
      const userEl = document.createElement('div');
      userEl.style.cssText = `
        width:20px;height:20px;border-radius:50%;
        background:#0052A5;border:3px solid white;
        box-shadow:0 0 0 5px rgba(0,82,165,0.25);
        animation:userPulse 2s infinite;
      `;
      // Add pulse animation
      if (!document.getElementById('ola-pulse-style')) {
        const style = document.createElement('style');
        style.id = 'ola-pulse-style';
        style.textContent = `
          @keyframes userPulse { 0%,100%{box-shadow:0 0 0 4px rgba(0,82,165,0.25)} 50%{box-shadow:0 0 0 10px rgba(0,82,165,0.08)} }
        `;
        document.head.appendChild(style);
      }
      new Marker({ element: userEl }).setLngLat([userLng, userLat]).addTo(map);

      map.on('load', async () => {
        if (cancelled) return;
        setStatus('ready');

        // 5. Fetch nearby hospitals and pharmacies in parallel
        const [hospitals, pharmacies] = await Promise.all([
          fetchNearby(userLat, userLng, 'hospital'),
          fetchNearby(userLat, userLng, 'pharmacy'),
        ]);
        if (cancelled) return;

        const allPlaces = [...hospitals, ...pharmacies];
        placesRef.current = allPlaces;

        addMarkers(map, allPlaces, 'all', Marker, Popup);
      });
    }

    init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  function addMarkers(map: any, places: NearbyPlace[], filterType: string, Marker: any, Popup: any) {
    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const filtered = filterType === 'all' ? places : places.filter(p => p.type === filterType);

    filtered.forEach(place => {
      const isHospital = place.type === 'hospital';
      const color = isHospital ? '#0052A5' : '#00897B';

      const el = document.createElement('div');
      el.style.cssText = `
        width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;
        background:${color};border:2.5px solid white;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);box-shadow:0 4px 12px ${color}66;
        transition:transform 0.2s,box-shadow 0.2s;
      `;
      const icon = document.createElement('span');
      icon.style.cssText = 'transform:rotate(45deg);font-size:15px;line-height:1;';
      icon.textContent = isHospital ? '🏥' : '💊';
      el.appendChild(icon);
      el.onmouseenter = () => { el.style.transform = 'rotate(-45deg) scale(1.2)'; el.style.boxShadow = `0 6px 20px ${color}88`; };
      el.onmouseleave = () => { el.style.transform = 'rotate(-45deg) scale(1)'; el.style.boxShadow = `0 4px 12px ${color}66`; };

      const popup = new Popup({ offset: 30, closeButton: true, className: 'ola-popup' })
        .setHTML(`
          <div style="padding:4px 2px;font-family:inherit;min-width:160px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="font-size:16px">${isHospital ? '🏥' : '💊'}</span>
              <strong style="color:${color};font-size:0.9rem;line-height:1.3">${place.name}</strong>
            </div>
            ${place.address ? `<p style="margin:0;color:#666;font-size:0.76rem;line-height:1.4">${place.address.substring(0, 80)}</p>` : ''}
            <a href="https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}"
               target="_blank" rel="noopener"
               style="display:inline-block;margin-top:6px;font-size:0.72rem;color:${color};font-weight:600;text-decoration:none;padding:3px 8px;border:1px solid ${color};border-radius:6px">
              📍 Get Directions
            </a>
          </div>
        `);

      const marker = new Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }

  // Handle filter change
  const handleFilter = async (newFilter: 'all' | 'hospital' | 'pharmacy') => {
    setFilter(newFilter);
    if (!mapRef.current || placesRef.current.length === 0) return;
    const maplibre = await import('maplibre-gl');
    const { Marker, Popup } = maplibre.default || maplibre;
    addMarkers(mapRef.current, placesRef.current, newFilter, Marker, Popup);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
        {(['all', 'hospital', 'pharmacy'] as const).map(f => (
          <button key={f} onClick={() => handleFilter(f)}
            style={{
              padding: '0.3rem 0.75rem', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.75rem', fontFamily: 'inherit',
              background: filter === f ? (f === 'pharmacy' ? '#00897B' : '#0052A5') : 'var(--surface-muted)',
              color: filter === f ? 'white' : 'var(--foreground-muted)',
              transition: 'all 0.2s',
            }}>
            {f === 'all' ? '🗺 All' : f === 'hospital' ? '🏥 Hospitals' : '💊 Pharmacies'}
          </button>
        ))}
        {locationLabel && (
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--charcoal)', alignSelf: 'center' }}>
            📍 {locationLabel}
          </span>
        )}
      </div>

      {/* Map Container */}
      <div style={{ position: 'relative', width: '100%', height, borderRadius: 16, overflow: 'hidden' }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} className={className} />
        {status !== 'ready' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            background: 'var(--surface-muted)', borderRadius: 16,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #0052A5', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--charcoal)', fontWeight: 500 }}>
              {status === 'locating' ? '📍 Getting your location…' : '🗺 Loading map…'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
