<script setup>
import { nextTick, onMounted, ref } from 'vue';
import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';
import { api, apiAuth, formatNumber, MONTH_NAMES } from '@/composables/api';
import { loadUgandaMap, useCharts, buildFarmMapOptions } from '@/composables/highcharts';

const { chart, mapChart, Highcharts } = useCharts();

const isLoggedIn = ref(!!localStorage.getItem('eudr_token'));
const loginEmail = ref('admin@admin.com');
const loginPassword = ref('admin');
const loginError = ref('');

const kpiItems = ref([]);
const alerts = ref([]);
const warehouseStatus = ref('Loading...');
const warehouseSyncStatus = ref('');
const ingestStatus = ref('');
const superset = ref({});
const ingestFile = ref(null);

const chartCompliancePie = ref(null);
const chartTrend = ref(null);
const chartTopDistricts = ref(null);
const chartRiskHeatmap = ref(null);
const chartProductionCrop = ref(null);
const chartRegional = ref(null);
const chartFarmMap = ref(null);

async function login() {
  loginError.value = '';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail.value, password: loginPassword.value }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    const data = await res.json();
    localStorage.setItem('eudr_token', data.token);
    isLoggedIn.value = true;
    await loadDashboard();
  } catch {
    loginError.value = 'Login failed. Use admin@admin.com / admin';
  }
}

function logout() {
  localStorage.removeItem('eudr_token');
  isLoggedIn.value = false;
}

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
        color: f.compliance_status === 'compliant' ? '#1a7f37' : f.compliance_status === 'non_compliant' ? '#d93025' : '#f4b400',
      }));
      mapChart(chartFarmMap.value, buildFarmMapOptions(farmPoints));
    } catch (e) {
      console.warn('Farm map load failed:', e);
    }
  }

  try {
    const [whStatus, cfg] = await Promise.all([
      api('/api/warehouse/status'),
      api('/api/auth/config'),
    ]);
    warehouseStatus.value = `Doris: ${whStatus.apache_doris} · Tables: ${(whStatus.tables || []).length} · ${whStatus.architecture}`;
    superset.value = cfg.superset || {};
  } catch {
    warehouseStatus.value = 'Warehouse unavailable (start full stack)';
  }
}

async function ingestData() {
  if (!ingestFile.value) return;
  const ext = ingestFile.value.name.split('.').pop().toLowerCase();
  const endpoint = ext === 'csv' ? '/api/ingestion/csv' : '/api/ingestion/excel';
  const form = new FormData();
  form.append('file', ingestFile.value);
  try {
    const data = await apiAuth(endpoint, { method: 'POST', body: form });
    ingestStatus.value = `Imported ${data.records_imported} records`;
  } catch (e) {
    ingestStatus.value = `Error: ${e.message}`;
  }
}

async function syncWarehouse() {
  warehouseSyncStatus.value = 'Syncing...';
  try {
    const data = await apiAuth('/api/warehouse/sync', { method: 'POST' });
    warehouseSyncStatus.value = data.message;
  } catch (e) {
    warehouseSyncStatus.value = `Error: ${e.message}`;
  }
}

function onFileChange(e) {
  ingestFile.value = e.target.files[0];
}

onMounted(() => {
  if (isLoggedIn.value) loadDashboard();
});
</script>

<template>
  <div v-if="!isLoggedIn" class="login-overlay">
    <div class="login-box">
      <h2>Strategic Dashboard</h2>
      <p class="login-sub">MAAIF officer access — demo: admin@admin.com / admin</p>
      <input v-model="loginEmail" type="email" placeholder="Email" autocomplete="username">
      <input v-model="loginPassword" type="password" placeholder="Password" autocomplete="current-password">
      <button class="btn btn-primary" style="width:100%" type="button" @click="login">Sign In</button>
      <p v-if="loginError" style="color:#d93025;margin-top:0.75rem">{{ loginError }}</p>
    </div>
  </div>

  <template v-else>
    <AppHeader title="Strategic Management Dashboard" subtitle="MAAIF EUDR Compliance — Leadership View">
      <template #nav>
        <a v-if="superset.enabled && superset.url" :href="superset.url" target="_blank" rel="noopener noreferrer">Superset BI</a>
        <a href="#" @click.prevent="logout">Logout</a>
      </template>
    </AppHeader>

    <div class="container">
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

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
        <div class="card">
          <h3>Alerts & Notifications</h3>
          <ul class="alert-list">
            <li v-for="(a, i) in alerts" :key="i" :class="a.priority">
              <strong>{{ a.type }}:</strong> {{ a.message }}
            </li>
          </ul>
        </div>
        <div class="card">
          <h3>Data Warehouse &amp; Superset</h3>
          <p style="font-size:0.9rem;color:#6b7280;margin-bottom:0.75rem">{{ warehouseStatus }}</p>
          <template v-if="superset.enabled && superset.url">
            <a :href="superset.url" class="btn btn-primary" target="_blank" rel="noopener noreferrer">Open Apache Superset</a>
            <p style="margin-top:0.5rem;font-size:0.8rem;color:#6b7280">
              URL: <a :href="superset.url" target="_blank" rel="noopener noreferrer">{{ superset.url }}</a>
            </p>
          </template>
          <p v-else class="form-msg" style="margin-bottom:0.75rem">
            {{ superset.note || 'Enable warehouse: ENABLE_WAREHOUSE=true ./scripts/deploy.sh then sudo ./scripts/setup-nginx.sh' }}
          </p>
          <button class="btn btn-secondary" type="button" style="margin-top:0.5rem" @click="syncWarehouse">Sync Warehouse</button>
          <p style="margin-top:0.75rem;font-size:0.85rem;color:#6b7280">{{ warehouseSyncStatus }}</p>
          <p v-if="superset.admin_user && superset.enabled" style="margin-top:0.5rem;font-size:0.85rem">
            Superset login: {{ superset.admin_user }} / {{ superset.admin_password }}
          </p>
        </div>
      </div>

      <div class="card" style="margin-top:1.5rem">
        <h3>Data Ingestion</h3>
        <p style="font-size:0.9rem;color:#6b7280;margin-bottom:1rem">Upload CSV or Excel farmer data</p>
        <input type="file" accept=".csv,.xlsx,.xls" @change="onFileChange">
        <button class="btn btn-primary" type="button" style="margin-top:0.75rem" @click="ingestData">Import Data</button>
        <p style="margin-top:0.75rem;font-size:0.9rem">{{ ingestStatus }}</p>
      </div>
    </div>

    <AppFooter text="MAAIF EUDR Compliance Platform — Strategic Dashboard" />
  </template>
</template>
