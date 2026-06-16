let currentChart = null;
let layers = [];
let activeLayer = 'districts';

const LAYER_CONFIG = {
  districts: { metric: 'compliance_rate', min: 60, max: 100, colors: ['#fee2e2', '#1a7f37'], title: 'District Compliance Map' },
  regions: { metric: 'compliance_rate', min: 80, max: 90, colors: ['#dbeafe', '#1a73e8'], title: 'Regional Overview' },
  'coffee-belt': { metric: 'production_tons', min: 0, max: 60000, colors: ['#f5f0eb', '#6f4e37'], title: 'Coffee Production Belt' },
  'risk-zones': { metric: 'risk_score', min: 0, max: 100, colors: ['#d1fae5', '#d93025'], title: 'Deforestation Risk Zones' },
  'farm-clusters': { type: 'points', title: 'Registered Farm Plot Locations' },
};

async function loadLayerList() {
  const res = await api('/api/geo/layers');
  layers = res.layers;
  const tabs = document.getElementById('layer-tabs');
  const tbody = document.querySelector('#layers-table tbody');
  tabs.innerHTML = layers.map(l =>
    `<button class="map-tab ${l.id === activeLayer ? 'active' : ''}" data-layer="${l.id}">${l.name}</button>`
  ).join('');
  tbody.innerHTML = layers.map(l =>
    `<tr><td>${l.id}</td><td>${l.name}</td><td>${l.type}</td><td><code>/api/geo/layers/${l.id}</code></td></tr>`
  ).join('');
  tabs.querySelectorAll('.map-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeLayer = btn.dataset.layer;
      tabs.querySelectorAll('.map-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMap();
    });
  });
}

async function renderMap() {
  const metric = document.getElementById('metric-select').value;
  const cfg = LAYER_CONFIG[activeLayer] || LAYER_CONFIG.districts;
  document.getElementById('map-title').textContent = cfg.title;

  const geo = await api(`/api/geo/layers/${activeLayer}?metric=${metric}`);
  if (currentChart) currentChart.destroy();

  if (activeLayer === 'farm-clusters' || geo.features?.[0]?.geometry?.type === 'Point') {
    const points = geo.features.map(f => ({
      name: f.properties.name || f.properties.farmer,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      color: f.properties.status === 'compliant' ? '#1a7f37' : f.properties.status === 'non_compliant' ? '#d93025' : '#f4b400',
      district: f.properties.district,
      risk: f.properties.risk_score,
    }));
    const script = document.createElement('script');
    if (!Highcharts.maps['countries/ug/ug-all']) {
      script.src = 'https://code.highcharts.com/mapdata/countries/ug/ug-all.js';
      document.head.appendChild(script);
      await new Promise(r => { script.onload = r; });
    }
    currentChart = Highcharts.mapChart('map-chart', {
      chart: { map: 'countries/ug/ug-all' },
      title: { text: null },
      credits: { enabled: false },
      mapNavigation: { enabled: true, buttonOptions: { verticalAlign: 'bottom' } },
      series: [{
        name: 'Uganda', mapData: Highcharts.maps['countries/ug/ug-all'],
        nullColor: '#f3f4f6', borderColor: '#ccc', showInLegend: false,
      }, {
        type: 'mappoint', name: 'Farm Plots', data: points,
        marker: { radius: 7, lineWidth: 1, lineColor: '#fff' },
        tooltip: { pointFormat: '<b>{point.name}</b><br>{point.district}<br>Risk: {point.risk}' },
      }],
    });
    return;
  }

  const mapData = Highcharts.geojson(geo);
  const m = metric || cfg.metric;
  mapData.forEach(p => { p.value = p.properties[m] ?? p.properties.compliance_rate; });

  currentChart = Highcharts.mapChart('map-chart', {
    chart: { map: mapData },
    title: { text: null },
    credits: { enabled: false },
    colorAxis: {
      min: cfg.min, max: cfg.max,
      minColor: cfg.colors[0], maxColor: cfg.colors[1],
    },
    mapNavigation: { enabled: true },
    series: [{
      data: mapData,
      joinBy: ['name', 'name'],
      name: m.replace('_', ' '),
      states: { hover: { color: '#f4b400' } },
      dataLabels: { enabled: true, format: '{point.properties.name}', style: { fontSize: '9px' } },
      tooltip: {
        pointFormat: '<b>{point.properties.name}</b><br>Compliance: {point.properties.compliance_rate}%<br>Risk: {point.properties.risk_score}',
      },
    }],
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  Highcharts.setOptions({ credits: { enabled: false } });
  await loadLayerList();
  document.getElementById('metric-select').addEventListener('change', renderMap);
  renderMap();
});
