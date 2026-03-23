/* eslint-disable */
import React, { useEffect, useRef, useState } from 'react';

const MAPBOX_TOKEN = 'pk.eyJ1IjoidGpob3VzdCIsImEiOiJjbW4yeWVoeDUxZDhvMnJxOXk5emZkMTVpIn0.DVl7blsuFeefq7DNk9u5WA';

// Lazy load mapbox-gl from CDN
function loadMapbox() {
  return new Promise((resolve) => {
    if (window.mapboxgl) return resolve(window.mapboxgl);
    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    document.head.appendChild(link);
    // Load JS
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.onload = () => resolve(window.mapboxgl);
    document.head.appendChild(script);
  });
}

// ── Timer Map — shows worker location + boundary ──────────────
export function TimerMap({ position, site, gpsStatus }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markerRef    = useRef(null);

  useEffect(() => {
    loadMapbox().then(mapboxgl => {
      if (!containerRef.current || mapRef.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const centre = position
        ? [position.lng, position.lat]
        : site?.centre_lng && site?.centre_lat
          ? [site.centre_lng, site.centre_lat]
          : [153.0251, -27.4698]; // Brisbane default

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: centre,
        zoom: 15,
        attributionControl: false,
      });
      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        // Draw site boundary circle if we have a site
        if (site?.centre_lat && site?.centre_lng && site?.radius_metres) {
          // Add boundary circle as GeoJSON
          const circleGeoJSON = createCircle([site.centre_lng, site.centre_lat], site.radius_metres);
          map.addSource('boundary', { type: 'geojson', data: circleGeoJSON });
          map.addLayer({
            id: 'boundary-fill',
            type: 'fill',
            source: 'boundary',
            paint: { 'fill-color': '#1a6dc9', 'fill-opacity': 0.1 },
          });
          map.addLayer({
            id: 'boundary-line',
            type: 'line',
            source: 'boundary',
            paint: { 'line-color': '#1a6dc9', 'line-width': 2, 'line-dasharray': [3, 2] },
          });
        }

        // Add worker marker if we have position
        if (position) {
          const el = document.createElement('div');
          el.style.cssText = `
            width: 20px; height: 20px; border-radius: 50%;
            background: ${gpsStatus === 'ok' ? '#1a8c5e' : '#b86a0a'};
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          `;
          markerRef.current = new mapboxgl.Marker(el)
            .setLngLat([position.lng, position.lat])
            .addTo(map);
        }
      });
    });

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // Update marker when position changes
  useEffect(() => {
    if (!mapRef.current || !position) return;
    if (markerRef.current) {
      markerRef.current.setLngLat([position.lng, position.lat]);
    }
    mapRef.current.easeTo({ center: [position.lng, position.lat], duration: 1000 });
  }, [position]);

  return (
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', height: 200 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {gpsStatus === 'getting' && (
        <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 10px', borderRadius: 6, fontSize: 11 }}>
          Getting location...
        </div>
      )}
    </div>
  );
}

// ── Geofence Editor Map ───────────────────────────────────────
export function GeofenceMap({ site, onBoundaryChange }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const [radius, setRadius] = useState(site?.radius_metres || 200);

  useEffect(() => {
    loadMapbox().then(mapboxgl => {
      if (!containerRef.current || mapRef.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const centre = site?.centre_lat && site?.centre_lng
        ? [site.centre_lng, site.centre_lat]
        : [153.0251, -27.4698];

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: centre,
        zoom: 15,
        attributionControl: false,
      });
      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        const circleGeoJSON = createCircle(centre, radius);
        map.addSource('boundary', { type: 'geojson', data: circleGeoJSON });
        map.addLayer({ id: 'boundary-fill', type: 'fill', source: 'boundary', paint: { 'fill-color': '#1a6dc9', 'fill-opacity': 0.15 } });
        map.addLayer({ id: 'boundary-line', type: 'line', source: 'boundary', paint: { 'line-color': '#1a6dc9', 'line-width': 2.5 } });

        // Draggable centre marker
        const el = document.createElement('div');
        el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#1a6dc9;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:move;';
        const marker = new mapboxgl.Marker({ element: el, draggable: true })
          .setLngLat(centre)
          .addTo(map);

        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          const newCircle = createCircle([lngLat.lng, lngLat.lat], radius);
          map.getSource('boundary').setData(newCircle);
          if (onBoundaryChange) onBoundaryChange({ centre_lat: lngLat.lat, centre_lng: lngLat.lng, radius_metres: radius });
        });
      });
    });

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  function updateRadius(newRadius) {
    setRadius(newRadius);
    if (mapRef.current && mapRef.current.getSource('boundary')) {
      const centre = site?.centre_lng && site?.centre_lat ? [site.centre_lng, site.centre_lat] : [153.0251, -27.4698];
      mapRef.current.getSource('boundary').setData(createCircle(centre, newRadius));
    }
    if (onBoundaryChange) onBoundaryChange({ radius_metres: newRadius });
  }

  return (
    <div>
      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', height: 320 }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.65)', color: 'white', padding: '4px 10px', borderRadius: 6, fontSize: 11 }}>
          Drag centre marker to reposition boundary
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Radius: {radius}m</label>
        <input
          type="range" min="50" max="2000" step="50" value={radius}
          onChange={e => updateRadius(parseInt(e.target.value))}
          style={{ flex: 1 }}
        />
      </div>
    </div>
  );
}

// ── Exceptions Map — shows where worker was flagged ───────────
export function ExceptionMap({ entries }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);

  useEffect(() => {
    if (!entries?.length) return;
    loadMapbox().then(mapboxgl => {
      if (!containerRef.current || mapRef.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const firstWithGPS = entries.find(e => e.start_lat && e.start_lng);
      const centre = firstWithGPS
        ? [firstWithGPS.start_lng, firstWithGPS.start_lat]
        : [153.0251, -27.4698];

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: centre,
        zoom: 13,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', () => {
        entries.forEach(e => {
          if (!e.start_lat || !e.start_lng) return;
          const el = document.createElement('div');
          el.style.cssText = `
            width: 14px; height: 14px; border-radius: 50%;
            background: ${!e.gps_captured ? '#c0392b' : '#b86a0a'};
            border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer;
          `;
          new mapboxgl.Marker(el)
            .setLngLat([e.start_lng, e.start_lat])
            .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML(
              `<div style="font-size:12px;padding:4px">
                <strong>${e.first_name} ${e.last_name}</strong><br/>
                ${!e.gps_captured ? 'GPS missing' : 'Outside boundary'}<br/>
                <span style="color:#666">${new Date(e.entry_date).toLocaleDateString()}</span>
              </div>`
            ))
            .addTo(map);
        });
      });
    });

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [entries]);

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', height: 260, marginBottom: 16 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

// ── Helper: create circle GeoJSON ────────────────────────────
function createCircle(centre, radiusMetres, steps = 64) {
  const coords = [];
  const earthRadius = 6371000;
  const lat = centre[1] * Math.PI / 180;
  const lng = centre[0] * Math.PI / 180;
  const r = radiusMetres / earthRadius;

  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const pLat = Math.asin(Math.sin(lat) * Math.cos(r) + Math.cos(lat) * Math.sin(r) * Math.cos(angle));
    const pLng = lng + Math.atan2(Math.sin(angle) * Math.sin(r) * Math.cos(lat), Math.cos(r) - Math.sin(lat) * Math.sin(pLat));
    coords.push([pLng * 180 / Math.PI, pLat * 180 / Math.PI]);
  }

  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } };
}
