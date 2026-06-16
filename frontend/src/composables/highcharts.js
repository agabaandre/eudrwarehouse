import { onBeforeUnmount } from 'vue';
import Highcharts from 'highcharts/highmaps';
import Exporting from 'highcharts/modules/exporting';

Exporting(Highcharts);

Highcharts.setOptions({
  credits: { enabled: false },
  chart: { style: { fontFamily: 'Segoe UI, system-ui, sans-serif' } },
});

let ugandaMapLoaded = false;

export function loadUgandaMap() {
  if (Highcharts.maps?.['countries/ug/ug-all']) {
    ugandaMapLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://code.highcharts.com/mapdata/countries/ug/ug-all.js';
    script.onload = () => {
      // Merge CDN map data into the ES-module Highcharts instance
      if (window.Highcharts?.maps) {
        Highcharts.maps = Highcharts.maps || {};
        Object.assign(Highcharts.maps, window.Highcharts.maps);
      }
      ugandaMapLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function buildFarmMapOptions(farmPoints) {
  const points = farmPoints
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
    .map((p) => ({
      name: p.name,
      lat: p.lat,
      lon: p.lon,
      marker: {
        fillColor: p.color || '#1a7f37',
        lineColor: '#fff',
        lineWidth: 1,
        radius: 7,
      },
    }));

  return {
    chart: { map: 'countries/ug/ug-all' },
    title: { text: null },
    mapNavigation: { enabled: true, buttonOptions: { verticalAlign: 'bottom' } },
    legend: { enabled: points.length > 0 },
    series: [{
      name: 'Uganda',
      mapData: Highcharts.maps['countries/ug/ug-all'],
      borderColor: '#ccc',
      nullColor: '#f5f5f5',
      showInLegend: false,
      enableMouseTracking: false,
    }, {
      type: 'mappoint',
      name: 'Farms',
      data: points,
      keys: ['name', 'lat', 'lon'],
      tooltip: {
        pointFormat: '<b>{point.name}</b><br>Lat: {point.lat:.4f}, Lon: {point.lon:.4f}',
      },
    }],
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

export function buildChoroplethOptions(mapData, {
  min = 60, max = 100, minColor = '#fee2e2', maxColor = '#1a7f37',
  valueKey = 'compliance_rate', seriesName = 'Compliance %',
  useUgandaBase = true,
}) {
  mapData.forEach((p) => {
    p.value = p.properties?.[valueKey] ?? p.properties?.compliance_rate ?? 0;
  });

  const series = [{
    data: mapData,
    joinBy: ['name', 'name'],
    name: seriesName,
    states: { hover: { color: '#f4b400' } },
    dataLabels: { enabled: true, format: '{point.properties.name}', style: { fontSize: '8px', textOutline: 'none' } },
    tooltip: {
      pointFormat: '<b>{point.properties.name}</b><br/>Compliance: {point.properties.compliance_rate}%<br/>Risk: {point.properties.risk_score}<br/>Production: {point.properties.production_tons} t',
    },
  }];

  const options = {
    chart: { map: mapData },
    title: { text: null },
    colorAxis: { min, max, minColor, maxColor },
    mapNavigation: { enabled: true, buttonOptions: { verticalAlign: 'bottom' } },
    series,
  };

  return options;
}
