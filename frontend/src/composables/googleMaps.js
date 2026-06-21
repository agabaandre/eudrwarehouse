let loadPromise = null;

function parseHex(hex) {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

export function interpolateColor(value, min, max, minColor, maxColor) {
  if (value == null || Number.isNaN(value)) return '#e8eef4';
  const span = max - min || 1;
  const t = Math.min(1, Math.max(0, (value - min) / span));
  const a = parseHex(minColor);
  const b = parseHex(maxColor);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}

export function getFeatureCentroid(feature) {
  const geom = feature.geometry;
  if (!geom) return null;
  let ring = null;
  if (geom.type === 'Polygon') ring = geom.coordinates[0];
  else if (geom.type === 'MultiPolygon') ring = geom.coordinates[0][0];
  if (!ring?.length) return null;
  let lat = 0;
  let lng = 0;
  ring.forEach(([lng0, lat0]) => {
    lng += lng0;
    lat += lat0;
  });
  return { lat: lat / ring.length, lng: lng / ring.length };
}

export function loadGoogleMaps(apiKey) {
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps API key is not configured (set GOOGLE_MAPS_API_KEY).'));
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const id = 'google-maps-js';
    if (document.getElementById(id)) {
      const wait = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(wait);
          resolve(window.google.maps);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(wait);
        reject(new Error('Google Maps script timed out'));
      }, 15000);
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load Google Maps JavaScript API'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export class UgandaGeoMap {
  constructor(container, maps) {
    this.maps = maps;
    this.dataLayer = null;
    this.labelMarkers = [];
    this.infoWindow = new maps.InfoWindow();
    this.map = new maps.Map(container, {
      center: { lat: 1.3733, lng: 32.2903 },
      zoom: 7,
      mapTypeId: 'terrain',
      streetViewControl: false,
      fullscreenControl: true,
      mapTypeControl: true,
    });
  }

  clearOverlays() {
    if (this.dataLayer) {
      this.dataLayer.setMap(null);
      this.dataLayer = null;
    }
    this.labelMarkers.forEach((marker) => marker.setMap(null));
    this.labelMarkers = [];
    this.infoWindow.close();
  }

  renderGeoJson(geojson, options = {}) {
    this.clearOverlays();
    const {
      min = 0,
      max = 100,
      minColor = '#fee2e2',
      maxColor = '#1a7f37',
      valueKey = 'compliance_rate',
      metricLabel = 'Value',
      showDistrictLabels = false,
    } = options;

    this.dataLayer = new this.maps.Data();
    this.dataLayer.addGeoJson(geojson);
    this.dataLayer.setStyle((feature) => {
      const props = {};
      feature.forEachProperty((val, key) => { props[key] = val; });
      const raw = props[valueKey] ?? props.compliance_rate ?? props.risk_score ?? props.production_tons;
      const numeric = raw != null ? parseFloat(raw) : null;
      return {
        fillColor: interpolateColor(numeric, min, max, minColor, maxColor),
        fillOpacity: 0.72,
        strokeColor: '#0f5132',
        strokeWeight: 1.4,
      };
    });
    this.dataLayer.setMap(this.map);

    this.dataLayer.addListener('click', (event) => {
      const props = {};
      event.feature.forEachProperty((val, key) => { props[key] = val; });
      const name = props.name || props.district || props.region || 'Area';
      const val = props[valueKey] ?? props.compliance_rate ?? props.risk_score ?? props.production_tons;
      this.infoWindow.setContent(
        `<div style="font-family:Inter,sans-serif;padding:4px 2px">`
        + `<strong>${name}</strong><br/>${metricLabel}: <strong>${val != null ? Number(val).toFixed(1) : 'N/A'}</strong>`
        + `</div>`,
      );
      this.infoWindow.setPosition(event.latLng);
      this.infoWindow.open(this.map);
    });

    if (showDistrictLabels) {
      (geojson.features || []).forEach((feature) => {
        const name = feature.properties?.name || feature.properties?.district || feature.properties?.region;
        const center = getFeatureCentroid(feature);
        if (!name || !center) return;
        const marker = new this.maps.Marker({
          position: center,
          map: this.map,
          label: {
            text: name,
            color: '#062e1c',
            fontSize: '11px',
            fontWeight: '600',
          },
          icon: {
            path: this.maps.SymbolPath.CIRCLE,
            scale: 0,
          },
          zIndex: 1000,
        });
        this.labelMarkers.push(marker);
      });
    }

    const bounds = new this.maps.LatLngBounds();
    let hasBounds = false;
    (geojson.features || []).forEach((feature) => {
      const geom = feature.geometry;
      const rings = geom?.type === 'Polygon'
        ? [geom.coordinates[0]]
        : geom?.type === 'MultiPolygon'
          ? geom.coordinates.map((poly) => poly[0])
          : [];
      rings.forEach((ring) => {
        ring.forEach(([lng, lat]) => {
          bounds.extend({ lat, lng });
          hasBounds = true;
        });
      });
    });
    if (hasBounds) {
      this.map.fitBounds(bounds, 48);
    }
  }

  destroy() {
    this.clearOverlays();
    this.map = null;
  }
}
