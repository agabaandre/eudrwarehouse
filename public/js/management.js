function showDashboard() {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('main-header').style.display = 'flex';
  document.getElementById('dashboard-content').style.display = 'block';
  loadDashboard();
}

async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    const data = await res.json();
    localStorage.setItem('eudr_token', data.token);
    showDashboard();
  } catch {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('login-error').textContent = 'Login failed. Use admin@admin.com / admin';
  }
}

async function loadDashboard() {
  Highcharts.setOptions({ credits: { enabled: false } });

  const [kpis, overview, trend, districts, risk, regional, alerts, farms, production] = await Promise.all([
    api('/api/analytics/kpis'),
    api('/api/analytics/compliance-overview'),
    api('/api/analytics/compliance-trend'),
    api('/api/analytics/district-performance'),
    api('/api/analytics/risk-heatmap'),
    api('/api/analytics/regional-distribution'),
    api('/api/analytics/alerts'),
    api('/api/analytics/map-farms'),
    api('/api/analytics/production-trends'),
  ]);

  const kpiItems = [
    { label: 'Registered Farmers', value: formatNumber(kpis.total_farmers), trend: '▲ +12.5% vs last quarter' },
    { label: 'Farm Plots Mapped', value: formatNumber(kpis.total_farm_plots), trend: '▲ +8.3% vs last quarter' },
    { label: 'Total Farm Area', value: formatNumber(kpis.total_area_hectares) + ' ha', trend: '▲ +5.2%' },
    { label: 'EUDR Compliant', value: formatNumber(kpis.compliant_farms) + ' (85%)', trend: '▲ +15%' },
    { label: 'Non-Compliant', value: formatNumber(kpis.non_compliant_farms) + ' (10%)', trend: '▼ -5%' },
    { label: 'Export Value', value: 'UGX ' + kpis.export_value_ugx_trillion + 'T', trend: '▲ +22% vs last year' },
  ];
  document.getElementById('kpi-grid').innerHTML = kpiItems.map(k =>
    `<div class="kpi"><div class="value">${k.value}</div><div class="label">${k.label}</div><div class="trend">${k.trend}</div></div>`
  ).join('');

  const compData = overview.data || [];
  Highcharts.chart('chart-compliance-pie', {
    chart: { type: 'pie' },
    title: { text: null },
    plotOptions: { pie: { innerSize: '50%' } },
    series: [{ name: 'Farms', data: compData.map(c => ({
      name: c.status.replace('_', ' '), y: c.count,
      color: c.status === 'compliant' ? '#1a7f37' : c.status === 'non_compliant' ? '#d93025' : '#f4b400',
    })) }],
  });

  const trendData = trend.data || [];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  Highcharts.chart('chart-trend', {
    chart: { type: 'line' },
    title: { text: null },
    xAxis: { categories: trendData.map(t => monthNames[t.month-1] + ' 2025') },
    yAxis: { title: { text: '%' }, max: 100 },
    series: [
      { name: 'Compliant', data: trendData.map(t => parseFloat(t.compliant_pct)), color: '#1a7f37' },
      { name: 'Non-Compliant', data: trendData.map(t => parseFloat(t.non_compliant_pct)), color: '#d93025' },
    ],
  });

  const distData = districts.data || districts;
  const top10 = [...distData].sort((a,b) => parseFloat(b.compliance_rate) - parseFloat(a.compliance_rate)).slice(0, 10);
  Highcharts.chart('chart-top-districts', {
    chart: { type: 'bar' },
    title: { text: null },
    xAxis: { categories: top10.map(d => d.name) },
    yAxis: { title: { text: 'Compliance %' }, max: 100 },
    series: [{ name: 'Compliance', data: top10.map(d => parseFloat(d.compliance_rate)), color: '#1a7f37' }],
  });

  const riskData = risk.data || [];
  Highcharts.chart('chart-risk-heatmap', {
    chart: { type: 'column' },
    title: { text: null },
    xAxis: { categories: riskData.map(r => r.district), labels: { rotation: -45 } },
    yAxis: { title: { text: 'Risk Score' } },
    series: [{ name: 'Risk', data: riskData.map(r => ({
      y: r.risk_score,
      color: r.risk_category === 'low' ? '#1a7f37' : r.risk_category === 'medium' ? '#f4b400' : '#d93025',
    })) }],
  });

  Highcharts.chart('chart-production-crop', {
    chart: { type: 'line' },
    title: { text: null },
    xAxis: { categories: ['2021','2022','2023','2024','2025'] },
    yAxis: { title: { text: 'Tons' } },
    series: [
      { name: 'Coffee', data: [3500000, 3800000, 4100000, 4450000, 4800000], color: '#6f4e37' },
      { name: 'Cocoa', data: [450000, 480000, 510000, 540000, 580000], color: '#3d2314' },
    ],
  });

  const regData = regional.data || [];
  Highcharts.chart('chart-regional', {
    chart: { type: 'column' },
    title: { text: null },
    xAxis: { categories: regData.map(r => r.region) },
    yAxis: [{ title: { text: 'Farmers' } }, { title: { text: 'Compliance %' }, opposite: true, max: 100 }],
    series: [
      { name: 'Farmers', data: regData.map(r => r.farmers), color: '#1a73e8' },
      { name: 'Compliance %', data: regData.map(r => r.compliance_rate), yAxis: 1, type: 'line', color: '#1a7f37' },
    ],
  });

  const farmPoints = (farms.data || []).map(f => ({
    name: f.farmer_name,
    lat: parseFloat(f.latitude),
    lon: parseFloat(f.longitude),
    color: f.compliance_status === 'compliant' ? '#1a7f37' : f.compliance_status === 'non_compliant' ? '#d93025' : '#f4b400',
  }));
  Highcharts.mapChart('chart-farm-map', {
    chart: { map: 'countries/ug/ug-all' },
    title: { text: null },
    mapNavigation: { enabled: true },
    series: [{
      name: 'Uganda',
      mapData: Highcharts.maps['countries/ug/ug-all'],
      borderColor: '#ccc',
      nullColor: '#f5f5f5',
      showInLegend: false,
    }, {
      type: 'mappoint',
      name: 'Farms',
      data: farmPoints,
      marker: { radius: 6, lineWidth: 1, lineColor: '#fff' },
      tooltip: { pointFormat: '<b>{point.name}</b><br>Lat: {point.lat}, Lon: {point.lon}' },
    }],
  });

  document.getElementById('alert-list').innerHTML = (alerts.data || []).map(a =>
    `<li class="${a.priority}"><strong>${a.type}:</strong> ${a.message}</li>`
  ).join('');

  try {
    const [whStatus, cfg] = await Promise.all([
      api('/api/warehouse/status'),
      api('/api/auth/config'),
    ]);
    document.getElementById('warehouse-status').textContent =
      `Doris: ${whStatus.apache_doris} · Tables: ${(whStatus.tables || []).length} · ${whStatus.architecture}`;
    const superset = cfg.superset || {};
    if (superset.url) {
      ['superset-nav', 'superset-mgmt-link'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.href = superset.url; el.style.display = 'inline-block'; }
      });
      document.getElementById('superset-creds-mgmt').textContent =
        `Superset login: ${superset.admin_user || 'admin'} / ${superset.admin_password || 'admin'}`;
    }
  } catch (e) { console.warn('Warehouse status unavailable'); }
}

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('eudr_token')) showDashboard();

  document.getElementById('login-btn').addEventListener('click', login);
  document.getElementById('logout-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('eudr_token');
    location.reload();
  });

  document.getElementById('ingest-btn')?.addEventListener('click', async () => {
    const file = document.getElementById('ingest-file').files[0];
    if (!file) return;
    const token = localStorage.getItem('eudr_token');
    const ext = file.name.split('.').pop().toLowerCase();
    const endpoint = ext === 'csv' ? '/api/ingestion/csv' : '/api/ingestion/excel';
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    const data = await res.json();
    document.getElementById('ingest-status').textContent = res.ok
      ? `Imported ${data.records_imported} records`
      : `Error: ${data.error}`;
  });

  document.getElementById('warehouse-sync-btn')?.addEventListener('click', async () => {
    const token = localStorage.getItem('eudr_token');
    const el = document.getElementById('warehouse-sync-status');
    el.textContent = 'Syncing...';
    const res = await fetch('/api/warehouse/sync', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    el.textContent = res.ok ? data.message : `Error: ${data.error}`;
  });
});

// Load Uganda map for farm locations
const script = document.createElement('script');
script.src = 'https://code.highcharts.com/mapdata/countries/ug/ug-all.js';
document.head.appendChild(script);
