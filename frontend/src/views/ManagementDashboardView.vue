<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { api, formatNumber, MONTH_NAMES } from '@/composables/api';
import { loadUgandaMap, useCharts, buildFarmMapOptions } from '@/composables/highcharts';

const { chart, mapChart } = useCharts();

const kpiItems = ref([]);
const alerts = ref([]);

const chartCompliancePie = ref(null);
const chartTrend = ref(null);
const chartTopDistricts = ref(null);
const chartRiskHeatmap = ref(null);
const chartProductionCrop = ref(null);
const chartRegional = ref(null);
const chartFarmMap = ref(null);

async function loadDashboard() {
  const [kpis, overview, trend, districts, risk, regional, alertData, farms] = await Promise.all([
    api('/api/analytics/kpis'),
    api('/api/analytics/compliance-overview'),
    api('/api/analytics/compliance-trend'),
    api('/api/analytics/district-performance'),
    api('/api/analytics/risk-heatmap'),
    api('/api/analytics/regional-distribution'),
    api('/api/analytics/alerts'),
    api('/api/analytics/map-farms'),
  ]);

  kpiItems.value = [
    { label: 'Registered Farmers', value: formatNumber(kpis.total_farmers), trend: '▲ +12.5% vs last quarter' },
    { label: 'Farm Plots Mapped', value: formatNumber(kpis.total_farm_plots), trend: '▲ +8.3% vs last quarter' },
    { label: 'Total Farm Area', value: formatNumber(kpis.total_area_hectares) + ' ha', trend: '▲ +5.2%' },
    { label: 'EUDR Compliant', value: formatNumber(kpis.compliant_farms) + ' (85%)', trend: '▲ +15%' },
    { label: 'Non-Compliant', value: formatNumber(kpis.non_compliant_farms) + ' (10%)', trend: '▼ -5%' },
    { label: 'Export Value', value: 'UGX ' + kpis.export_value_ugx_trillion + 'T', trend: '▲ +22% vs last year' },
  ];

  alerts.value = alertData.data || [];

  await nextTick();

  const compData = overview.data || [];
  chart(chartCompliancePie.value, {
    chart: { type: 'pie' },
    title: { text: null },
    plotOptions: { pie: { innerSize: '50%' } },
    series: [{
      name: 'Farms',
      data: compData.map((c) => ({
        name: c.status.replace('_', ' '),
        y: c.count,
        color: c.status === 'compliant' ? '#1a7f37' : c.status === 'non_compliant' ? '#d93025' : '#f4b400',
      })),
    }],
  });

  const trendData = trend.data || [];
  chart(chartTrend.value, {
    chart: { type: 'line' },
    title: { text: null },
    xAxis: { categories: trendData.map((t) => MONTH_NAMES[t.month - 1] + ' 2025') },
    yAxis: { title: { text: '%' }, max: 100 },
    series: [
      { name: 'Compliant', data: trendData.map((t) => parseFloat(t.compliant_pct)), color: '#1a7f37' },
      { name: 'Non-Compliant', data: trendData.map((t) => parseFloat(t.non_compliant_pct)), color: '#d93025' },
    ],
  });

  const distData = districts.data || districts;
  const top10 = [...distData].sort((a, b) => parseFloat(b.compliance_rate) - parseFloat(a.compliance_rate)).slice(0, 10);
  chart(chartTopDistricts.value, {
    chart: { type: 'bar' },
    title: { text: null },
    xAxis: { categories: top10.map((d) => d.name) },
    yAxis: { title: { text: 'Compliance %' }, max: 100 },
    series: [{ name: 'Compliance', data: top10.map((d) => parseFloat(d.compliance_rate)), color: '#1a7f37' }],
  });

  const riskData = risk.data || [];
  chart(chartRiskHeatmap.value, {
    chart: { type: 'column' },
    title: { text: null },
    xAxis: { categories: riskData.map((r) => r.district), labels: { rotation: -45 } },
    yAxis: { title: { text: 'Risk Score' } },
    series: [{
      name: 'Risk',
      data: riskData.map((r) => ({
        y: r.risk_score,
        color: r.risk_category === 'low' ? '#1a7f37' : r.risk_category === 'medium' ? '#f4b400' : '#d93025',
      })),
    }],
  });

  chart(chartProductionCrop.value, {
    chart: { type: 'line' },
    title: { text: null },
    xAxis: { categories: ['2021', '2022', '2023', '2024', '2025'] },
    yAxis: { title: { text: 'Tons' } },
    series: [
      { name: 'Coffee', data: [3500000, 3800000, 4100000, 4450000, 4800000], color: '#6f4e37' },
      { name: 'Cocoa', data: [450000, 480000, 510000, 540000, 580000], color: '#3d2314' },
    ],
  });

  const regData = regional.data || [];
  chart(chartRegional.value, {
    chart: { type: 'column' },
    title: { text: null },
    xAxis: { categories: regData.map((r) => r.region) },
    yAxis: [{ title: { text: 'Farmers' } }, { title: { text: 'Compliance %' }, opposite: true, max: 100 }],
    series: [
      { name: 'Farmers', data: regData.map((r) => r.farmers), color: '#1a73e8' },
      { name: 'Compliance %', data: regData.map((r) => r.compliance_rate), yAxis: 1, type: 'line', color: '#1a7f37' },
    ],
  });

  if (chartFarmMap.value) {
    try {
      await loadUgandaMap();
      const farmPoints = (farms.data || []).map((f) => ({
        name: f.farmer_name || f.plot_code,
        lat: parseFloat(f.latitude),
        lon: parseFloat(f.longitude),
        district: f.district,
        status: f.compliance_status,
        commodity: f.commodity,
        color: f.compliance_status === 'compliant' ? '#1a7f37' : f.compliance_status === 'non_compliant' ? '#d93025' : '#f4b400',
      }));
      mapChart(chartFarmMap.value, buildFarmMapOptions(farmPoints));
    } catch (e) {
      console.warn('Farm map load failed:', e);
    }
  }
}

onMounted(loadDashboard);
</script>

<template>
  <div class="container">
    <div class="mgmt-page-intro">
      <h2>Strategic Dashboard</h2>
      <p>Leadership KPIs, compliance trends, risk analysis, and geospatial farm coverage.</p>
    </div>

    <div class="kpi-grid">
      <div v-for="k in kpiItems" :key="k.label" class="kpi">
        <div class="value">{{ k.value }}</div>
        <div class="label">{{ k.label }}</div>
        <div class="trend">{{ k.trend }}</div>
      </div>
    </div>

    <div class="chart-grid">
      <div class="chart-box"><h3>EUDR Compliance Overview</h3><div ref="chartCompliancePie" style="height:300px" /></div>
      <div class="chart-box"><h3>Compliance Trend Over Time</h3><div ref="chartTrend" style="height:300px" /></div>
      <div class="chart-box"><h3>Top 10 Districts — Compliance</h3><div ref="chartTopDistricts" style="height:300px" /></div>
      <div class="chart-box"><h3>Deforestation Risk Heatmap</h3><div ref="chartRiskHeatmap" style="height:300px" /></div>
      <div class="chart-box"><h3>Production Trends by Crop</h3><div ref="chartProductionCrop" style="height:300px" /></div>
      <div class="chart-box"><h3>Regional Distribution</h3><div ref="chartRegional" style="height:300px" /></div>
      <div class="chart-box" style="grid-column:1/-1"><h3>Geospatial Farm Locations</h3><div ref="chartFarmMap" style="height:400px" /></div>
    </div>

    <div class="card">
      <h3>Alerts &amp; Notifications</h3>
      <ul class="alert-list">
        <li v-for="(a, i) in alerts" :key="i" :class="a.priority">
          <strong>{{ a.type }}:</strong> {{ a.message }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.mgmt-page-intro { margin-bottom: 1.25rem; }
.mgmt-page-intro h2 { margin-bottom: 0.35rem; }
.mgmt-page-intro p { color: var(--muted); font-size: 0.95rem; }
</style>
