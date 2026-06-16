<script setup>
import { nextTick, onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';
import { api, MONTH_NAMES } from '@/composables/api';
import { buildChoroplethOptions, useCharts } from '@/composables/highcharts';

const { chart, mapChart, Highcharts } = useCharts();

const showGuide = ref(false);
const filterRegion = ref('');
const filterDistrict = ref('');
const filterCrop = ref('');
const reportRows = ref([]);

const chartProduction = ref(null);
const chartDistricts = ref(null);
const chartExports = ref(null);
const chartExporters = ref(null);
const chartTrend = ref(null);
const chartAge = ref(null);
const chartRisk = ref(null);
const chartMap = ref(null);

async function runReport() {
  const params = new URLSearchParams();
  if (filterRegion.value) params.set('region', filterRegion.value);
  if (filterDistrict.value) params.set('district', filterDistrict.value);
  if (filterCrop.value) params.set('crop', filterCrop.value);
  const result = await api(`/api/analytics/custom-report?${params}`);
  reportRows.value = result.data || [];
}

async function loadCharts() {
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
  const months = [...new Set(monthly.filter((m) => m.commodity === 'coffee').map((m) => m.month))].sort((a, b) => a - b);

  await nextTick();

  chart(chartProduction.value, {
    chart: { type: 'line' },
    title: { text: null },
    xAxis: { categories: months.map((m) => MONTH_NAMES[m - 1]) },
    yAxis: { title: { text: 'Tons' } },
    series: [
      { name: 'Coffee', data: months.map((m) => Number(monthly.find((x) => x.month === m && x.commodity === 'coffee')?.production_tons || 0)) },
      { name: 'Cocoa', data: months.map((m) => Number(monthly.find((x) => x.month === m && x.commodity === 'cocoa')?.production_tons || 0)) },
    ],
  });

  const sorted = [...districtData].sort((a, b) => parseFloat(b.compliance_rate) - parseFloat(a.compliance_rate));
  chart(chartDistricts.value, {
    chart: { type: 'bar' },
    title: { text: null },
    xAxis: { categories: sorted.map((d) => d.name || d.district_name) },
    yAxis: { title: { text: 'Compliance %' }, max: 100 },
    series: [{ name: 'Compliance Rate', data: sorted.map((d) => parseFloat(d.compliance_rate)), color: '#1a7f37' }],
    plotOptions: {
      series: {
        cursor: 'pointer',
        point: {
          events: {
            click() {
              filterDistrict.value = this.category;
              runReport();
            },
          },
        },
      },
    },
  });

  const dest = exports.destinations || [];
  chart(chartExports.value, {
    chart: { type: 'pie' },
    title: { text: null },
    series: [{ name: 'Volume', data: dest.map((d) => ({ name: d.destination_country, y: Number(d.volume_tons) })) }],
  });

  const exp = exports.exporters || [];
  chart(chartExporters.value, {
    chart: { type: 'column' },
    title: { text: null },
    xAxis: { categories: exp.map((e) => e.name.split(' ').slice(0, 2).join(' ')), labels: { rotation: -45 } },
    yAxis: { title: { text: 'Volume (tons)' } },
    series: [{ name: 'Volume', data: exp.map((e) => Number(e.volume_tons)), color: '#1a73e8' }],
  });

  const trendData = trend.data || [];
  chart(chartTrend.value, {
    chart: { type: 'area' },
    title: { text: null },
    xAxis: { categories: trendData.map((t) => MONTH_NAMES[t.month - 1]) },
    yAxis: { title: { text: '%' }, max: 100 },
    series: [
      { name: 'Compliant', data: trendData.map((t) => parseFloat(t.compliant_pct)), color: '#1a7f37' },
      { name: 'Non-Compliant', data: trendData.map((t) => parseFloat(t.non_compliant_pct)), color: '#d93025' },
      { name: 'Pending', data: trendData.map((t) => parseFloat(t.pending_pct)), color: '#f4b400' },
    ],
  });

  const age = demographics.age_distribution || [];
  chart(chartAge.value, {
    chart: { type: 'pie' },
    title: { text: null },
    series: [{ name: 'Farmers', data: age.map((a) => ({ name: a.group, y: a.count })) }],
  });

  const riskData = risk.data || [];
  chart(chartRisk.value, {
    chart: { type: 'column' },
    title: { text: null },
    xAxis: { categories: riskData.slice(0, 15).map((r) => r.district), labels: { rotation: -45 } },
    yAxis: {
      title: { text: 'Risk Score' },
      plotBands: [
        { from: 0, to: 30, color: 'rgba(26,127,55,0.1)' },
        { from: 31, to: 60, color: 'rgba(244,180,0,0.1)' },
        { from: 61, to: 100, color: 'rgba(217,48,37,0.1)' },
      ],
    },
    series: [{
      name: 'Risk Score',
      data: riskData.slice(0, 15).map((r) => r.risk_score),
      colorByPoint: true,
      colors: riskData.slice(0, 15).map((r) => (r.risk_score <= 30 ? '#1a7f37' : r.risk_score <= 60 ? '#f4b400' : '#d93025')),
    }],
  });

  try {
    const geo = await api('/api/geo/layers/districts?metric=compliance_rate');
    if (geo.features?.length) {
      const mapData = Highcharts.geojson(geo);
      mapChart(chartMap.value, buildChoroplethOptions(mapData, {
        min: 60, max: 100, minColor: '#fee2e2', maxColor: '#1a7f37',
        valueKey: 'compliance_rate', seriesName: 'Compliance %',
      }));
    }
  } catch (e) {
    console.warn('Map load failed:', e);
  }
}

onMounted(async () => {
  try {
    const cfg = await api('/api/auth/config');
    showGuide.value = cfg.public_user_guide_enabled;
  } catch { /* optional */ }
  await loadCharts();
  await runReport();
});
</script>

<template>
  <AppHeader title="Analytics & Reporting Dashboard" subtitle="MAAIF EUDR Compliance — Public View" />

  <div class="container">
    <div class="page-intro">
      <h2>National EUDR Analytics</h2>
      <p>Real-time production, compliance, and export performance across Uganda — filter and export custom reports.</p>
    </div>

    <div v-if="showGuide" class="user-guide">
      <h4>User Guide</h4>
      <p>Use filters below to build custom reports. Click district bars to drill down.</p>
    </div>

    <div class="filter-bar">
      <div>
        <label>Region</label><br>
        <select v-model="filterRegion">
          <option value="">All Regions</option>
          <option>Western</option><option>Eastern</option><option>Central</option><option>Northern</option>
        </select>
      </div>
      <div>
        <label>District</label><br>
        <input v-model="filterDistrict" type="text" placeholder="e.g. Kabale">
      </div>
      <div>
        <label>Crop</label><br>
        <select v-model="filterCrop">
          <option value="">All</option>
          <option value="coffee">Coffee</option>
          <option value="cocoa">Cocoa</option>
        </select>
      </div>
      <button class="btn btn-primary" type="button" @click="runReport">Generate Report</button>
    </div>

    <div class="chart-grid">
      <div class="chart-box"><h3>Monthly Production Trends (2025)</h3><div ref="chartProduction" style="height:300px" /></div>
      <div class="chart-box"><h3>District Compliance Rates</h3><div ref="chartDistricts" style="height:300px" /></div>
      <div class="chart-box"><h3>Export Destinations by Volume</h3><div ref="chartExports" style="height:300px" /></div>
      <div class="chart-box"><h3>Top Exporters</h3><div ref="chartExporters" style="height:300px" /></div>
      <div class="chart-box"><h3>Compliance Trend (2025)</h3><div ref="chartTrend" style="height:300px" /></div>
      <div class="chart-box"><h3>Farmer Demographics — Age</h3><div ref="chartAge" style="height:300px" /></div>
      <div class="chart-box"><h3>Risk Score by District</h3><div ref="chartRisk" style="height:300px" /></div>
      <div class="chart-box"><h3>Uganda District Compliance Map</h3><div ref="chartMap" style="height:300px" /></div>
    </div>

    <div class="card">
      <h3>Custom Report Results</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>District</th><th>Region</th><th>Compliance Rate</th><th>Risk Score</th></tr></thead>
          <tbody>
            <tr v-for="row in reportRows" :key="row.district">
              <td>{{ row.district }}</td>
              <td>{{ row.region }}</td>
              <td>{{ row.compliance_rate }}%</td>
              <td>{{ row.risk_score }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <AppFooter text="MAAIF EUDR Compliance Platform — Analytics Dashboard" />
</template>
