'use client';
import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

interface OlaMapProps {
  center?: [number, number]; // [longitude, latitude]
  zoom?: number;
  markers?: Array<{
    id: string;
    lngLat: [number, number];
    title: string;
    description?: string;
  }>;
  height?: string;
  className?: string;
}

// Tamil Nadu hospitals seed data for demo
export const TAMIL_NADU_HOSPITALS = [
  { id: 'apollo-chennai',    lngLat: [80.2512,  13.0604] as [number,number], title: 'Apollo Hospitals',      description: 'Greams Road, Chennai' },
  { id: 'fortis-chennai',   lngLat: [80.2082,  13.0569] as [number,number], title: 'Fortis Malar Hospital',  description: 'Adyar, Chennai' },
  { id: 'kmch-coimbatore',  lngLat: [76.9559,  11.0168] as [number,number], title: 'KMCH',                   description: 'Coimbatore' },
  { id: 'meenakshi-madurai',lngLat: [78.1198,  9.9248]  as [number,number], title: 'Meenakshi Mission',      description: 'Madurai' },
  { id: 'govt-rajaji',      lngLat: [78.1198,  9.9198]  as [number,number], title: 'Govt. Rajaji Hospital',  description: 'Madurai' },
  { id: 'ggh-chennai',      lngLat: [80.2688,  13.0836] as [number,number], title: 'Govt General Hospital',  description: 'Park Town, Chennai' },
];

export default function OlaMap({
  center = [80.2512, 13.0604],
  zoom = 11,
  markers = TAMIL_NADU_HOSPITALS,
  height = '380px',
  className = '',
}: OlaMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let map: any;

    async function initMap() {
      const maplibre = await import('maplibre-gl');
      const { Map, NavigationControl, Marker, Popup } = maplibre.default || maplibre;

      const apiKey = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY;

      map = new Map({
        container: mapContainer.current!,
        style: `https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json?api_key=${apiKey}`,
        center,
        zoom,
        attributionControl: false,
      });

      map.addControl(new NavigationControl(), 'top-right');

      mapRef.current = map;

      map.on('load', () => {
        markers.forEach(({ id, lngLat, title, description }) => {
          const popup = new Popup({ offset: 25, closeButton: true })
            .setHTML(`
              <div style="padding:6px 2px;font-family:inherit">
                <strong style="color:#0052A5;font-size:0.93rem">${title}</strong>
                ${description ? `<p style="margin:2px 0 0;color:#555;font-size:0.8rem">${description}</p>` : ''}
              </div>
            `);

          // Custom marker element
          const el = document.createElement('div');
          el.style.cssText = `
            width:34px;height:34px;cursor:pointer;
            background:#0052A5;border:3px solid white;
            border-radius:50% 50% 50% 0;transform:rotate(-45deg);
            box-shadow:0 4px 12px rgba(0,82,165,0.4);
            transition:transform 0.2s;
          `;
          el.onmouseenter = () => { el.style.transform = 'rotate(-45deg) scale(1.2)'; };
          el.onmouseleave = () => { el.style.transform = 'rotate(-45deg) scale(1)'; };

          new Marker({ element: el })
            .setLngLat(lngLat)
            .setPopup(popup)
            .addTo(map);
        });
      });
    }

    initMap().catch(console.error);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mapContainer}
      className={className}
      style={{ position: 'relative', width: '100%', height, borderRadius: 16, overflow: 'hidden' }}
    />
  );
}
