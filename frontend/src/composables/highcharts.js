import { onBeforeUnmount } from 'vue';
import Highcharts from 'highcharts/highmaps';
import Exporting from 'highcharts/modules/exporting';

Exporting(Highcharts);

Highcharts.setOptions({
  credits: { enabled: false },
  chart: { style: { fontFamily: 'Segoe UI, system-ui, sans-serif' } },
});

const UG_MAP_KEY = 'countries/ug/ug-all';

export function loadUgandaMap() {
  if (Highcharts.maps?.[UG_MAP_KEY]) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://code.highcharts.com/mapdata/countries/ug/ug-all.js';
    script.onload = () => {
      if (window.Highcharts?.maps) {
        Highcharts.maps = Highcharts.maps || {};
        Object.assign(Highcharts.maps, window.Highcharts.maps);
      }
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function valueLookupFromGeo(geo, valueKey) {
  const lookup = {};
  (geo.features || []).forEach((f) => {
    const name = f.properties?.name || f.properties?.district || f.properties?.region;
    if (!name) return;
    lookup[name] = f.properties?.[valueKey]
      ?? f.properties?.compliance_rate
      ?? f.properties?.risk_score
      ?? f.properties?.production_tons
      ?? null;
  });
  return lookup;
}

function ugandaBaseSeries() {
  const ugMap = Highcharts.maps[UG_MAP_KEY];
  if (!ugMap) return null;
  return {
    name: 'Uganda',
    mapData: ugMap,
    borderColor: '#475569',
    borderWidth: 0.6,
    nullColor: '#e8eef4',
    showInLegend: false,
    enableMouseTracking: false,
    states: { inactive: { opacity: 1 } },
  };
}

/** Choropleth on real Uganda district boundaries (Highcharts map collection). */
function buildDistrictChoropleth(geo, options) {
  const ugMap = Highcharts.maps[UG_MAP_KEY];
  const valueKey = options.valueKey || 'compliance_rate';
  const values = valueLookupFromGeo(geo, valueKey);

  const mapData = Highcharts.geojson(ugMap, 'map');
  mapData.forEach((point) => {
    const name = point.name || point.properties?.name;
    point.value = name && values[name] != null ? values[name] : null;
  });

  const series = [ugandaBaseSeries(), {
    type: 'map',
    name: options.seriesName,
    data: mapData,
    mapData: ugMap,
    joinBy: 'hc-key',
    nullColor: '#e8eef4',
    borderColor: '#334155',
    borderWidth: 0.4,
    states: { hover: { color: '#fcdc04' } },
    dataLabels: {
      enabled: mapData.length <= 40,
      format: '{point.name}',
      style: { fontSize: '8px', textOutline: 'none', fontWeight: 'normal' },
    },
    tooltip: {
      pointFormat: '<b>{point.name}</b><br/>{series.name}: <b>{point.value:.1f}</b>',
    },
  }].filter(Boolean);

  return {
    chart: { map: UG_MAP_KEY },
    title: { text: null },
    colorAxis: {
      min: options.min,
      max: options.max,
      minColor: options.minColor,
      maxColor: options.maxColor,
    },
    mapNavigation: { enabled: true, buttonOptions: { verticalAlign: 'bottom' } },
    legend: { enabled: true },
    series,
  };
}

/** Regional / custom polygon layers drawn over Uganda country outline. */
function buildCustomChoropleth(geo, options) {
  const valueKey = options.valueKey || 'compliance_rate';
  const customData = Highcharts.geojson(geo, 'map');
  customData.forEach((p) => {
    const props = p.properties || {};
    p.value = props[valueKey] ?? props.compliance_rate ?? props.risk_score ?? 0;
    if (!p.name && props.name) p.name = props.name;
  });

  const ugMap = Highcharts.maps[UG_MAP_KEY];
  const outline = ugMap ? Highcharts.geojson(ugMap, 'mapline') : [];

  const series = [];
  if (outline.length) {
    series.push({
      type: 'mapline',
      name: 'Uganda border',
      data: outline,
      color: '#475569',
      lineWidth: 1.5,
      enableMouseTracking: false,
      showInLegend: false,
    });
  }
  series.push({
    type: 'map',
    name: options.seriesName,
    data: customData,
    joinBy: 'name',
    borderColor: '#0f5132',
    borderWidth: 1,
    states: { hover: { color: '#fcdc04' } },
    dataLabels: {
      enabled: true,
      format: '{point.name}',
      style: { fontSize: '11px', fontWeight: '600', textOutline: 'none' },
    },
    tooltip: {
      pointFormat: '<b>{point.name}</b><br/>{series.name}: <b>{point.value:.1f}</b>',
    },
  });

  return {
    chart: { map: customData },
    title: { text: null },
    colorAxis: {
      min: options.min,
      max: options.max,
      minColor: options.minColor,
      maxColor: options.maxColor,
    },
    mapNavigation: { enabled: true, buttonOptions: { verticalAlign: 'bottom' } },
    legend: { enabled: true },
    series,
  };
}

export function buildChoroplethOptions(geo, options = {}) {
  if (!Highcharts.maps?.[UG_MAP_KEY]) {
    throw new Error('Uganda map not loaded — call loadUgandaMap() first');
  }

  const layerId = options.layerId || 'districts';
  const useDistrictMap = layerId === 'districts' || layerId === 'farm-clusters';

  if (useDistrictMap) {
    return buildDistrictChoropleth(geo, options);
  }
  return buildCustomChoropleth(geo, options);
}

export function buildFarmMapOptions(farmPoints) {
  const points = farmPoints
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
    .map((p) => ({
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      marker: {
        fillColor: p.color || '#0f5132',
        lineColor: '#fff',
        lineWidth: 1,
        radius: 7,
      },
    }));

  const series = [ugandaBaseSeries(), {
    type: 'mappoint',
    name: 'Farms',
    data: points,
    keys: ['name', 'lat', 'lon'],
    tooltip: {
      pointFormat: '<b>{point.name}</b><br>Lat: {point.lat:.4f}, Lon: {point.lon:.4f}',
    },
  }].filter(Boolean);

  return {
    chart: { map: UG_MAP_KEY },
    title: { text: null },
    mapNavigation: { enabled: true, buttonOptions: { verticalAlign: 'bottom' } },
    legend: { enabled: points.length > 0 },
    series,
  };
}

export function useCharts() {
  const instances = [];

  function chart(el, options) {
    if (!el) return null;
    const instance = Highcharts.chart(el, options);
    instances.push(instance);
    return instance;
  }

  function mapChart(el, options) {
    if (!el) return null;
    const instance = Highcharts.mapChart(el, options);
    instances.push(instance);
    return instance;
  }

  onBeforeUnmount(() => {
    instances.forEach((c) => c?.destroy());
    instances.length = 0;
  });

  return { chart, mapChart, Highcharts };
}
