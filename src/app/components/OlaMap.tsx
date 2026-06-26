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
    const searchUrl = `https://api.olamaps.io/places/v1/nearbysearch?location=${lat},${lng}&radius=5000&types=${type}&api_key=${OLA_API_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    if (searchData.status !== 'ok' || !searchData.predictions) return [];

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

// Popup card rendered inside the map overlay (not MapLibre native popup)
function PlacePopup({ place, onClose }: { place: NearbyPlace; onClose: () => void }) {
  const [info, setInfo] = useState<{ phone?: string; hours?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/agents/place-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: place.name, address: place.address, type: place.type }),
    })
      .then(r => r.json())
      .then(d => setInfo(d))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [place.place_id]);

  const isHospital = place.type === 'hospital';
  const color = isHospital ? '#0052A5' : '#00897B';

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 999,
        background: 'white', borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        padding: '1rem 1.1rem',
        borderTop: `4px solid ${color}`,
        animation: 'slideUpCard 0.25s ease',
        fontFamily: 'inherit',
      }}
    >
      <style>{`@keyframes slideUpCard { from { transform:translateY(20px); opacity:0 } to { transform:translateY(0); opacity:1 } }`}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{isHospital ? '🏥' : '💊'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color, marginBottom: '0.2rem', lineHeight: 1.3 }}>{place.name}</div>
          {place.address && (
            <div style={{ fontSize: '0.78rem', color: '#555', marginBottom: '0.5rem', lineHeight: 1.45 }}>
              📍 {place.address.substring(0, 100)}
            </div>
          )}
          {loading && (
            <div style={{ fontSize: '0.78rem', color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, border: '2px solid #ccc', borderTopColor: color, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Fetching contact info…
            </div>
          )}
          {!loading && info && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {info.phone && (
                <a href={`tel:${info.phone.replace(/\s/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color, fontWeight: 700, textDecoration: 'none' }}>
                  📞 {info.phone}
                </a>
              )}
              {info.hours && (
                <div style={{ fontSize: '0.78rem', color: '#444' }}>🕐 {info.hours}</div>
              )}
              {!info.phone && !info.hours && (
                <div style={{ fontSize: '0.76rem', color: '#888' }}>Contact info unavailable</div>
              )}
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.07)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: '1rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>✕</button>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
          target="_blank" rel="noopener"
          style={{ flex: 1, textAlign: 'center', padding: '0.5rem', borderRadius: 10, background: color, color: 'white', fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none' }}
        >
          🧭 Get Directions
        </a>
        {info?.phone && (
          <a
            href={`tel:${info.phone.replace(/\s/g, '')}`}
            style={{ flex: 1, textAlign: 'center', padding: '0.5rem', borderRadius: 10, border: `1.5px solid ${color}`, color, fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none' }}
          >
            📞 Call
          </a>
        )}
      </div>
    </div>
  );
}

export default function OlaMap({ height = '380px', className = '' }: { height?: string; className?: string }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [status, setStatus] = useState<'locating' | 'loading' | 'ready' | 'error'>('locating');
  const [locationLabel, setLocationLabel] = useState('');
  const [filter, setFilter] = useState<'all' | 'hospital' | 'pharmacy'>('all');
  const placesRef = useRef<NearbyPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      let userLat = DEFAULT_CENTER[1];
      let userLng = DEFAULT_CENTER[0];

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
        );
        if (cancelled) return;
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        setLocationLabel('Your location');
      } catch {
        setLocationLabel('Chennai (location unavailable)');
      }

      setStatus('loading');
      if (cancelled) return;

      const maplibre = await import('maplibre-gl');
      if (cancelled) return;
      const { Map, NavigationControl, Marker } = maplibre.default || maplibre;

      // Fetch and sanitize style JSON to avoid MapLibre validation errors with Ola's style
      let styleObj: any = `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${OLA_API_KEY}`;
      try {
        const styleRes = await fetch(styleObj);
        const styleJson = await styleRes.json();
        if (styleJson.layers) {
          styleJson.layers = styleJson.layers.filter((l: any) => l.id !== '3d_model_data' && l['source-layer'] !== '3d_model');
        }
        styleObj = styleJson;
      } catch (e) {
        console.warn('Failed to sanitize style JSON, falling back to URL', e);
      }
      if (cancelled) return;

      const map = new Map({
        container: mapContainer.current!,
        style: styleObj,
        center: [userLng, userLat],
        zoom: 14,
        attributionControl: false,
        transformRequest: (url: string, resourceType?: string) => {
          if (url.includes('api.olamaps.io') && !url.includes('api_key=')) {
            const sep = url.includes('?') ? '&' : '?';
            return { url: `${url}${sep}api_key=${OLA_API_KEY}` };
          }
          return { url };
        },
      });

      map.addControl(new NavigationControl(), 'top-right');
      mapRef.current = map;

      // User location dot (plain circle, no transform issues)
      const userEl = document.createElement('div');
      userEl.style.cssText = `width:18px;height:18px;border-radius:50%;background:#0052A5;border:3px solid white;box-shadow:0 0 0 5px rgba(0,82,165,0.2);flex-shrink:0;`;
      new Marker({ element: userEl }).setLngLat([userLng, userLat]).addTo(map);

      // Close popup when clicking map background
      map.on('click', () => setSelectedPlace(null));

      map.on('load', async () => {
        if (cancelled) return;
        setStatus('ready');

        const [hospitals, pharmacies] = await Promise.all([
          fetchNearby(userLat, userLng, 'hospital'),
          fetchNearby(userLat, userLng, 'pharmacy'),
        ]);
        if (cancelled) return;

        const allPlaces = [...hospitals, ...pharmacies];
        placesRef.current = allPlaces;
        renderMarkers(map, allPlaces, 'all', Marker, setSelectedPlace);
      });
    }

    init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  function renderMarkers(map: any, places: NearbyPlace[], filterType: string, Marker: any, onSelect: (p: NearbyPlace) => void) {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const filtered = filterType === 'all' ? places : places.filter(p => p.type === filterType);

    filtered.forEach(place => {
      const isHospital = place.type === 'hospital';
      const color = isHospital ? '#0052A5' : '#00897B';

      // Wrapper keeps the MapLibre anchor at bottom-center; inner div handles visual rotation
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `width:40px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;`;

      const pin = document.createElement('div');
      pin.style.cssText = `
        width:34px;height:34px;display:flex;align-items:center;justify-content:center;
        background:${color};border:2.5px solid white;
        border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        box-shadow:0 3px 10px ${color}77;
        transition:box-shadow 0.2s,filter 0.2s;
        pointer-events:none;
      `;
      const icon = document.createElement('span');
      icon.style.cssText = `transform:rotate(45deg);font-size:14px;line-height:1;pointer-events:none;`;
      icon.textContent = isHospital ? '🏥' : '💊';
      pin.appendChild(icon);
      wrapper.appendChild(pin);

      // Hover brightens the pin without touching the transform
      wrapper.onmouseenter = () => { pin.style.filter = 'brightness(1.2)'; pin.style.boxShadow = `0 6px 18px ${color}aa`; };
      wrapper.onmouseleave = () => { pin.style.filter = ''; pin.style.boxShadow = `0 3px 10px ${color}77`; };
      wrapper.onclick = (e) => { e.stopPropagation(); onSelect(place); };

      const marker = new Marker({ element: wrapper, anchor: 'bottom' })
        .setLngLat([place.lng, place.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }

  const handleFilter = async (newFilter: 'all' | 'hospital' | 'pharmacy') => {
    setFilter(newFilter);
    setSelectedPlace(null);
    if (!mapRef.current || placesRef.current.length === 0) return;
    const maplibre = await import('maplibre-gl');
    const { Marker } = maplibre.default || maplibre;
    renderMarkers(mapRef.current, placesRef.current, newFilter, Marker, setSelectedPlace);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
        {(['all', 'hospital', 'pharmacy'] as const).map(f => (
          <button key={f} onClick={() => handleFilter(f)}
            style={{
              padding: '0.3rem 0.75rem', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.75rem', fontFamily: 'inherit',
              background: filter === f ? (f === 'pharmacy' ? '#00897B' : '#0052A5') : 'var(--surface-muted, #f1f5f9)',
              color: filter === f ? 'white' : '#555',
              transition: 'all 0.2s',
            }}>
            {f === 'all' ? '🗺 All' : f === 'hospital' ? '🏥 Hospitals' : '💊 Pharmacies'}
          </button>
        ))}
        {locationLabel && (
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#888' }}>📍 {locationLabel}</span>
        )}
      </div>

      <div style={{ position: 'relative', width: '100%', height, borderRadius: 16, overflow: 'hidden' }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} className={className} />

        {/* Loading overlay */}
        {status !== 'ready' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            background: '#f1f5f9', borderRadius: 16,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #0052A5', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: '0.82rem', color: '#555', fontWeight: 500 }}>
              {status === 'locating' ? '📍 Getting your location…' : '🗺 Loading map…'}
            </span>
          </div>
        )}

        {/* Custom place popup card */}
        {selectedPlace && (
          <PlacePopup place={selectedPlace} onClose={() => setSelectedPlace(null)} />
        )}
      </div>
    </div>
  );
}
