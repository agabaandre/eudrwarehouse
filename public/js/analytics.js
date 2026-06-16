document.addEventListener('DOMContentLoaded', async () => {
  Highcharts.setOptions({ credits: { enabled: false } });

  fetch('/api/auth/config').then(r => r.json()).then(cfg => {
    if (cfg.public_user_guide_enabled) document.getElementById('user-guide').style.display = 'block';
  });

  const [production, districts, exports, trend, demographics, risk] = await Promise.all([
    api('/api/analytics/production-trends'),
    api('/api/analytics/district-performance'),
    api('/api/analytics/export-performance'),
    api('/api/analytics/compliance-trend'),
    api('/api/analytics/farmer-demographics'),
    api('/api/analytics/risk-heatmap'),
  ]);

  const districtData = districts.data || districts;
  const monthly = production.monthly || [];
  const months = [...new Set(monthly.filter(m => m.commodity === 'coffee').map(m => m.month))].sort((a,b) => a-b);
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  Highcharts.chart('chart-production', {
    chart: { type: 'line' },
    title: { text: null },
    xAxis: { categories: months.map(m => monthNames[m-1]) },
    yAxis: { title: { text: 'Tons' } },
    series: [
      { name: 'Coffee', data: months.map(m => Number(monthly.find(x => x.month === m && x.commodity === 'coffee')?.production_tons || 0)) },
      { name: 'Cocoa', data: months.map(m => Number(monthly.find(x => x.month === m && x.commodity === 'cocoa')?.production_tons || 0)) },
    ],
  });

  const sorted = [...districtData].sort((a,b) => parseFloat(b.compliance_rate) - parseFloat(a.compliance_rate));
  Highcharts.chart('chart-districts', {
    chart: { type: 'bar' },
    title: { text: null },
    xAxis: { categories: sorted.map(d => d.name || d.district_name) },
    yAxis: { title: { text: 'Compliance %' }, max: 100 },
    series: [{ name: 'Compliance Rate', data: sorted.map(d => parseFloat(d.compliance_rate)), color: '#1a7f37' }],
    plotOptions: { series: { cursor: 'pointer', point: { events: { click() { document.getElementById('filter-district').value = this.category; runReport(); } } } } },
  });

  const dest = exports.destinations || [];
  Highcharts.chart('chart-exports', {
    chart: { type: 'pie' },
    title: { text: null },
    series: [{ name: 'Volume', data: dest.map(d => ({ name: d.destination_country, y: Number(d.volume_tons) })) }],
  });

  const exp = exports.exporters || [];
  Highcharts.chart('chart-exporters', {
    chart: { type: 'column' },
    title: { text: null },
    xAxis: { categories: exp.map(e => e.name.split(' ').slice(0,2).join(' ')), labels: { rotation: -45 } },
    yAxis: { title: { text: 'Volume (tons)' } },
    series: [{ name: 'Volume', data: exp.map(e => Number(e.volume_tons)), color: '#1a73e8' }],
  });

  const trendData = trend.data || [];
  Highcharts.chart('chart-compliance-trend', {
    chart: { type: 'area' },
    title: { text: null },
    xAxis: { categories: trendData.map(t => monthNames[t.month-1]) },
    yAxis: { title: { text: '%' }, max: 100 },
    series: [
      { name: 'Compliant', data: trendData.map(t => parseFloat(t.compliant_pct)), color: '#1a7f37' },
      { name: 'Non-Compliant', data: trendData.map(t => parseFloat(t.non_compliant_pct)), color: '#d93025' },
      { name: 'Pending', data: trendData.map(t => parseFloat(t.pending_pct)), color: '#f4b400' },
    ],
  });

  const age = demographics.age_distribution || [];
  Highcharts.chart('chart-age', {
    chart: { type: 'pie' },
    title: { text: null },
    series: [{ name: 'Farmers', data: age.map(a => ({ name: a.group, y: a.count })) }],
  });

  const riskData = risk.data || [];
  Highcharts.chart('chart-risk', {
    chart: { type: 'column' },
    title: { text: null },
    xAxis: { categories: riskData.slice(0,15).map(r => r.district), labels: { rotation: -45 } },
    yAxis: { title: { text: 'Risk Score' }, plotBands: [
      { from: 0, to: 30, color: 'rgba(26,127,55,0.1)' },
      { from: 31, to: 60, color: 'rgba(244,180,0,0.1)' },
      { from: 61, to: 100, color: 'rgba(217,48,37,0.1)' },
    ]},
    series: [{ name: 'Risk Score', data: riskData.slice(0,15).map(r => r.risk_score),
      colorByPoint: true, colors: riskData.slice(0,15).map(r => r.risk_score <= 30 ? '#1a7f37' : r.risk_score <= 60 ? '#f4b400' : '#d93025') }],
  });

  try {
    const geo = await api('/api/geo/layers/districts?metric=compliance_rate');
    const mapData = Highcharts.geojson(geo);
    mapData.forEach(p => { p.value = p.properties.compliance_rate; });
    Highcharts.mapChart('chart-map', {
      chart: { map: mapData },
      title: { text: null },
      colorAxis: { min: 60, max: 100, minColor: '#fee2e2', maxColor: '#1a7f37' },
      series: [{ data: mapData, joinBy: 'name', name: 'Compliance %', states: { hover: { color: '#f4b400' } },
        dataLabels: { enabled: true, format: '{point.properties.name}' } }],
    });
  } catch (e) { console.warn('Map load failed:', e); }

  async function runReport() {
    const region = document.getElementById('filter-region').value;
    const district = document.getElementById('filter-district').value;
    const crop = document.getElementById('filter-crop').value;
    const params = new URLSearchParams();
    if (region) params.set('region', region);
    if (district) params.set('district', district);
    if (crop) params.set('crop', crop);
    const result = await api(`/api/analytics/custom-report?${params}`);
    const tbody = document.querySelector('#report-table tbody');
    tbody.innerHTML = result.data.map(r => `<tr><td>${r.district}</td><td>${r.region}</td><td>${r.compliance_rate}%</td><td>${r.risk_score}</td></tr>`).join('');
  }

  document.getElementById('run-report').addEventListener('click', runReport);
  runReport();
});
