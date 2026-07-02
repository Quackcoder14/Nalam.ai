'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LocateFixed, Search } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

const OLA_API_KEY = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY || '';
const DEFAULT_CENTER: [number, number] = [80.2512, 13.0604]; // Chennai fallback
type PlaceType = 'hospital' | 'pharmacy' | 'clinic' | 'doctor' | 'health' | 'medical_store';

interface NearbyPlace {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: PlaceType;
  phone?: string;
  hours?: string;
}

function pickPhone(result: any) {
  return result?.formatted_phone_number || result?.international_phone_number || result?.phone_number || result?.contact?.phone_number || result?.contact?.phone || null;
}

function pickHours(result: any) {
  if (Array.isArray(result?.opening_hours?.weekday_text)) return result.opening_hours.weekday_text.join(', ');
  if (typeof result?.opening_hours?.open_now === 'boolean') return result.opening_hours.open_now ? 'Open now' : 'Closed now';
  return result?.business_status || null;
}

function dedupePlaces(places: NearbyPlace[]) {
  const seen = new Set<string>();
  return places.filter((place) => {
    const key = place.place_id || `${place.name}|${place.address}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchNearby(lat: number, lng: number, type: PlaceType): Promise<NearbyPlace[]> {
  try {
    const searchUrl = `https://api.olamaps.io/places/v1/nearbysearch?location=${lat},${lng}&radius=12000&types=${type}&api_key=${OLA_API_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    if (searchData.status !== 'ok' || !searchData.predictions) return [];

    const places = await Promise.all(
      searchData.predictions.slice(0, 20).map(async (p: any) => {
        try {
          const detailUrl = `https://api.olamaps.io/places/v1/details?place_id=${p.place_id}&api_key=${OLA_API_KEY}`;
          const detailRes = await fetch(detailUrl);
          const detailData = await detailRes.json();
          if (detailData.status !== 'ok' || !detailData.result?.geometry?.location) return null;
          const result = detailData.result;
          return {
            place_id: p.place_id,
            name: result.name || p.structured_formatting?.main_text || 'Unknown',
            address: result.formatted_address || result.vicinity || p.structured_formatting?.secondary_text || p.description || '',
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
            type,
            phone: pickPhone(result) || undefined,
            hours: pickHours(result) || undefined,
          } as NearbyPlace;
        } catch { return null; }
      })
    );
    return dedupePlaces(places.filter(Boolean) as NearbyPlace[]);
  } catch { return []; }
}

async function geocodeLocation(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  try {
    const geocodeUrl = `https://api.olamaps.io/places/v1/geocode?address=${encodeURIComponent(cleanQuery)}&api_key=${OLA_API_KEY}`;
    const res = await fetch(geocodeUrl);
    const data = await res.json();
    const match = data.geocodingResults?.[0] || data.results?.[0] || data.predictions?.[0];
    const loc = match?.geometry?.location;
    if (loc?.lat && loc?.lng) {
      return { lat: loc.lat, lng: loc.lng, label: match.formatted_address || match.description || cleanQuery };
    }
  } catch {}

  try {
    const autocompleteUrl = `https://api.olamaps.io/places/v1/autocomplete?input=${encodeURIComponent(cleanQuery)}&api_key=${OLA_API_KEY}`;
    const res = await fetch(autocompleteUrl);
    const data = await res.json();
    const first = data.predictions?.[0];
    if (first?.place_id) {
      const detailRes = await fetch(`https://api.olamaps.io/places/v1/details?place_id=${first.place_id}&api_key=${OLA_API_KEY}`);
      const detailData = await detailRes.json();
      const loc = detailData.result?.geometry?.location;
      if (loc?.lat && loc?.lng) {
        return { lat: loc.lat, lng: loc.lng, label: detailData.result.formatted_address || first.description || cleanQuery };
      }
    }
  } catch {}

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(cleanQuery)}`;
    const res = await fetch(nominatimUrl);
    const data = await res.json();
    if (data?.[0]?.lat && data?.[0]?.lon) {
      return { lat: Number(data[0].lat), lng: Number(data[0].lon), label: data[0].display_name || cleanQuery };
    }
  } catch {}

  return null;
}

// Popup card rendered inside the map overlay (not MapLibre native popup)
function PlacePopup({ place, onClose }: { place: NearbyPlace; onClose: () => void }) {
  const [info, setInfo] = useState<{ phone?: string; hours?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (place.phone || place.hours) {
      setInfo({ phone: place.phone, hours: place.hours });
      setLoading(false);
      return;
    }

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
  }, [place]);

  const isHospital = place.type === 'hospital';
  const isClinic = place.type === 'clinic' || place.type === 'doctor';
  const isPharmacy = place.type === 'pharmacy' || place.type === 'medical_store';
  let color = '#0052A5';
  let icon = '🏥';
  if (isPharmacy) { color = '#00897B'; icon = '💊'; }
  else if (isClinic) { color = '#7C3AED'; icon = '🩺'; }
  else if (place.type === 'health') { color = '#C07A00'; icon = '🏥'; }

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
        <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{icon}</span>
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
  const [filter, setFilter] = useState<'all' | 'hospital' | 'pharmacy' | 'clinic' | 'doctor' | 'health'>('all');
  const [searchText, setSearchText] = useState('');
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [mapMessage, setMapMessage] = useState('');
  const placesRef = useRef<NearbyPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);
  const originMarkerRef = useRef<any>(null);

  const loadPlacesForLocation = async (lat: number, lng: number, label: string, zoom = 13.5) => {
    if (!mapRef.current) return;
    setLoadingPlaces(true);
    setSelectedPlace(null);
    setMapMessage('');

    const maplibre = await import('maplibre-gl');
    const { Marker } = maplibre.default || maplibre;

    mapRef.current.flyTo({ center: [lng, lat], zoom, essential: true });

    if (originMarkerRef.current) originMarkerRef.current.remove();
    const originEl = document.createElement('div');
    originEl.style.cssText = `width:18px;height:18px;border-radius:50%;background:#0052A5;border:3px solid white;box-shadow:0 0 0 5px rgba(0,82,165,0.2);flex-shrink:0;`;
    originMarkerRef.current = new Marker({ element: originEl }).setLngLat([lng, lat]).addTo(mapRef.current);

    const [hospitals, pharmacies, clinics, doctors, health, medicalStores] = await Promise.all([
      fetchNearby(lat, lng, 'hospital'),
      fetchNearby(lat, lng, 'pharmacy'),
      fetchNearby(lat, lng, 'clinic'),
      fetchNearby(lat, lng, 'doctor'),
      fetchNearby(lat, lng, 'health'),
      fetchNearby(lat, lng, 'medical_store'),
    ]);

    const allPlaces = dedupePlaces([...hospitals, ...pharmacies, ...clinics, ...doctors, ...health, ...medicalStores]);
    placesRef.current = allPlaces;
    setLocationLabel(label);
    renderMarkers(mapRef.current, allPlaces, filter, Marker, setSelectedPlace);
    setMapMessage(allPlaces.length ? `${allPlaces.length} places found nearby` : 'No hospitals or pharmacies found here. Try a nearby road, area, or pincode.');
    setLoadingPlaces(false);
  };

  useEffect(() => {
    let cancelled = false;

    async function init() {
      let userLat = DEFAULT_CENTER[1];
      let userLng = DEFAULT_CENTER[0];
      let activeLocationLabel = 'Chennai (location unavailable)';

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
        );
        if (cancelled) return;
        userLat = pos.coords.latitude;
        userLng = pos.coords.longitude;
        activeLocationLabel = 'Your location';
        setLocationLabel(activeLocationLabel);
      } catch {
        setLocationLabel(activeLocationLabel);
      }

      setStatus('loading');
      if (cancelled) return;

      const maplibre = await import('maplibre-gl');
      if (cancelled) return;
      const { Map, NavigationControl } = maplibre.default || maplibre;

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
        transformRequest: (url: string) => {
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
      // Close popup when clicking map background
      map.on('click', () => setSelectedPlace(null));

      map.on('load', async () => {
        if (cancelled) return;
        setStatus('ready');
        loadPlacesForLocation(userLat, userLng, activeLocationLabel);
      });
    }

    init();

    return () => {
      cancelled = true;
      originMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  function renderMarkers(map: any, places: NearbyPlace[], filterType: string, Marker: any, onSelect: (p: NearbyPlace) => void) {
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const filtered = filterType === 'all' ? places : places.filter(p => p.type === filterType);

    filtered.forEach(place => {
      const isHospital = place.type === 'hospital';
      const isClinic = place.type === 'clinic' || place.type === 'doctor';
      const isPharmacy = place.type === 'pharmacy' || place.type === 'medical_store';
      const isHealth = place.type === 'health';
      
      let color = '#0052A5';
      let icon = '🏥';
      if (isPharmacy) { color = '#00897B'; icon = '💊'; }
      else if (isClinic) { color = '#7C3AED'; icon = '🩺'; }
      else if (isHealth) { color = '#C07A00'; icon = '🏥'; }

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
      const iconEl = document.createElement('span');
      iconEl.style.cssText = `transform:rotate(45deg);font-size:14px;line-height:1;pointer-events:none;`;
      iconEl.textContent = icon;
      pin.appendChild(iconEl);
      wrapper.appendChild(pin);

      // Hover brightens the pin without touching the transform
      wrapper.onmouseenter = () => { pin.style.filter = 'brightness(1.2)'; pin.style.boxShadow = `0 6px 18px ${color}aa`; };
      wrapper.onmouseleave = () => { pin.style.filter = ''; pin.style.boxShadow = `0 3px 10px ${color}77`; };
      wrapper.onclick = (e) => { e.stopPropagation(); onSelect(place); };

      try {
        const marker = new Marker({ element: wrapper, anchor: 'bottom' })
          .setLngLat([place.lng, place.lat])
          .addTo(map);

        markersRef.current.push(marker);
      } catch (err) {
        console.error('Error adding marker:', err);
      }
    });
  }

  const handleFilter = async (newFilter: 'all' | 'hospital' | 'pharmacy' | 'clinic' | 'doctor' | 'health') => {
    setFilter(newFilter);
    setSelectedPlace(null);
    if (!mapRef.current || placesRef.current.length === 0) return;
    const maplibre = await import('maplibre-gl');
    const { Marker } = maplibre.default || maplibre;
    renderMarkers(mapRef.current, placesRef.current, newFilter, Marker, setSelectedPlace);
  };

  const handleManualSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchText.trim();
    if (!query) return;

    setLoadingPlaces(true);
    setMapMessage('');
    const result = await geocodeLocation(query);
    if (!result) {
      setLoadingPlaces(false);
      setMapMessage('Could not find that location. Try adding city or pincode, e.g. "Anna Nagar Chennai" or "625020 Madurai".');
      return;
    }

    await loadPlacesForLocation(result.lat, result.lng, result.label);
  };

  const handleUseCurrentLocation = async () => {
    setLoadingPlaces(true);
    setMapMessage('');
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      );
      await loadPlacesForLocation(pos.coords.latitude, pos.coords.longitude, 'Your location', 14);
    } catch {
      setLoadingPlaces(false);
      setMapMessage('Location permission is unavailable. Enter an area, town, landmark, or pincode manually.');
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <form onSubmit={handleManualSearch} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '0.45rem', marginBottom: '0.55rem' }}>
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search area, pincode, town..."
          style={{
            minWidth: 0,
            padding: '0.55rem 0.7rem',
            borderRadius: 10,
            border: '1px solid var(--border, #d8e0ea)',
            background: 'white',
            color: '#1f2937',
            fontFamily: 'inherit',
            fontSize: '0.82rem',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={loadingPlaces || !searchText.trim()}
          title="Search this location"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: 'none',
            background: searchText.trim() ? '#0052A5' : 'var(--surface-muted, #f1f5f9)',
            color: searchText.trim() ? 'white' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: searchText.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          <Search size={16} />
        </button>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={loadingPlaces}
          title="Use current location"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: '1px solid var(--border, #d8e0ea)',
            background: 'white',
            color: '#0052A5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loadingPlaces ? 'wait' : 'pointer',
          }}
        >
          <LocateFixed size={16} />
        </button>
      </form>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
        {(['all', 'hospital', 'pharmacy', 'clinic', 'doctor', 'health'] as const).map(f => {
          const colors: Record<string, { bg: string; text: string }> = {
            all: { bg: '#0052A5', text: 'white' },
            hospital: { bg: '#0052A5', text: 'white' },
            pharmacy: { bg: '#00897B', text: 'white' },
            clinic: { bg: '#7C3AED', text: 'white' },
            doctor: { bg: '#7C3AED', text: 'white' },
            health: { bg: '#C07A00', text: 'white' },
          };
          const labels: Record<string, string> = {
            all: '🗺 All',
            hospital: '🏥 Hospitals',
            pharmacy: '💊 Pharmacies',
            clinic: '🩺 Clinics',
            doctor: '👨‍⚕️ Doctors',
            health: '🏥 Health',
          };
          return (
            <button key={f} onClick={() => handleFilter(f)}
              style={{
                padding: '0.3rem 0.75rem', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.75rem', fontFamily: 'inherit',
                background: filter === f ? colors[f].bg : 'var(--surface-muted, #f1f5f9)',
                color: filter === f ? 'white' : '#555',
                transition: 'all 0.2s',
              }}>
              {labels[f]}
            </button>
          );
        })}
        {locationLabel && (
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#888' }}>📍 {locationLabel}</span>
        )}
      </div>

      {mapMessage && (
        <div style={{ marginTop: '-0.25rem', marginBottom: '0.55rem', color: mapMessage.startsWith('No ') || mapMessage.startsWith('Could ') || mapMessage.startsWith('Location ') ? '#B45309' : '#475569', fontSize: '0.74rem', fontWeight: 600 }}>
          {mapMessage}
        </div>
      )}

      <div style={{ position: 'relative', width: '100%', height, borderRadius: 16, overflow: 'hidden' }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} className={className} />

        {/* Loading overlay */}
        {(status !== 'ready' || loadingPlaces) && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            background: status === 'ready' ? 'rgba(241,245,249,0.78)' : '#f1f5f9', borderRadius: 16,
            zIndex: 20,
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
