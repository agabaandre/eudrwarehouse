<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';
import { api } from '@/composables/api';
import { buildChoroplethOptions, buildFarmMapOptions, loadUgandaMap, useCharts } from '@/composables/highcharts';

const { t } = useI18n();
const { mapChart, Highcharts } = useCharts();

const layers = ref([]);
const activeLayer = ref('districts');
const metric = ref('compliance_rate');
const mapTitle = ref('');
const mapEl = ref(null);
const mapError = ref('');
const loading = ref(true);
let mapInstance = null;

const LAYER_CONFIG = {
  districts: { metric: 'compliance_rate', min: 60, max: 100, colors: ['#fee2e2', '#1a7f37'], titleKey: 'maps.districtCompliance' },
  regions: { metric: 'compliance_rate', min: 80, max: 95, colors: ['#dbeafe', '#1a73e8'], titleKey: 'maps.regionalOverview' },
  'coffee-belt': { metric: 'production_tons', min: 0, max: 60000, colors: ['#f5f0eb', '#6f4e37'], titleKey: 'maps.coffeeBelt' },
  'risk-zones': { metric: 'risk_score', min: 0, max: 100, colors: ['#d1fae5', '#d93025'], titleKey: 'maps.riskZones' },
  'farm-clusters': { type: 'points', titleKey: 'maps.farmClusters' },
};

async function loadLayers() {
  const res = await api('/api/geo/layers');
  layers.value = res.layers || [];
  if (layers.value.length && !layers.value.find((l) => l.id === activeLayer.value)) {
    activeLayer.value = layers.value[0].id;
  }
}

async function renderMap() {
  mapError.value = '';
  loading.value = true;
  const cfg = LAYER_CONFIG[activeLayer.value] || LAYER_CONFIG.districts;
  mapTitle.value = t(cfg.titleKey || 'maps.districtCompliance');

  try {
    const geo = await api(`/api/geo/layers/${activeLayer.value}?metric=${metric.value}`);
    if (!geo.features?.length) {
      mapError.value = t('maps.noData');
      loading.value = false;
      return;
    }

    if (mapInstance) {
      mapInstance.destroy();
      mapInstance = null;
    }
    await nextTick();

    if (activeLayer.value === 'farm-clusters' || geo.features[0]?.geometry?.type === 'Point') {
      await loadUgandaMap();
      const points = geo.features.map((f) => ({
        name: f.properties.name || f.properties.farmer,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        color: f.properties.status === 'compliant' ? '#1a7f37' : f.properties.status === 'non_compliant' ? '#d93025' : '#f4b400',
      }));
      mapInstance = mapChart(mapEl.value, buildFarmMapOptions(points));
    } else {
      await loadUgandaMap();
      mapInstance = mapChart(mapEl.value, buildChoroplethOptions(geo, {
        layerId: activeLayer.value,
        min: cfg.min,
        max: cfg.max,
        minColor: cfg.colors[0],
        maxColor: cfg.colors[1],
        valueKey: metric.value || cfg.metric,
        seriesName: t(`maps.metrics.${metric.value || cfg.metric}`),
      }));
    }
  } catch (e) {
    mapError.value = e.message || t('maps.loadError');
    console.error('Map render failed:', e);
  } finally {
    loading.value = false;
  }
}

function selectLayer(id) {
  activeLayer.value = id;
  renderMap();
}

watch(metric, renderMap);

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.destroy();
    mapInstance = null;
  }
});

onMounted(async () => {
  try {
    await loadLayers();
    await renderMap();
  } catch (e) {
    mapError.value = e.message || t('maps.loadError');
    loading.value = false;
  }
});
</script>

<template>
  <AppHeader :title="t('maps.title')" :subtitle="t('maps.subtitle')" />

  <div class="container">
    <div class="page-intro">
      <h2>{{ t('maps.title') }}</h2>
      <p>{{ t('maps.subtitle') }}</p>
    </div>

    <div class="filter-bar">
      <div>
        <label>{{ t('maps.metric') }}</label><br>
        <select v-model="metric">
          <option value="compliance_rate">{{ t('maps.metrics.compliance_rate') }}</option>
          <option value="risk_score">{{ t('maps.metrics.risk_score') }}</option>
          <option value="production_tons">{{ t('maps.metrics.production_tons') }}</option>
        </select>
      </div>
    </div>

    <div v-if="layers.length" class="map-tabs">
      <button
        v-for="layer in layers"
        :key="layer.id"
        type="button"
        class="map-tab"
        :class="{ active: activeLayer === layer.id }"
        @click="selectLayer(layer.id)"
      >
        {{ layer.name }}
      </button>
    </div>
    <p v-else class="form-msg error">{{ mapError || t('maps.noLayers') }}</p>

    <div class="chart-box map-panel">
      <h3>{{ mapTitle }}</h3>
      <p v-if="loading" style="color:var(--muted)">{{ t('common.loading') }}</p>
      <p v-if="mapError" class="form-msg error">{{ mapError }}</p>
      <div ref="mapEl" style="height:480px" />
    </div>

    <div class="card" style="margin-top:1.5rem">
      <h3>{{ t('maps.apiLayers') }}</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>{{ t('common.name') }}</th><th>{{ t('common.type') }}</th><th>Endpoint</th></tr></thead>
          <tbody>
            <tr v-for="layer in layers" :key="layer.id">
              <td>{{ layer.id }}</td>
              <td>{{ layer.name }}</td>
              <td>{{ layer.type }}</td>
              <td><code>/api/geo/layers/{{ layer.id }}</code></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <AppFooter :text="t('maps.footer')" />
</template>

<style scoped>
.map-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
.map-tab { padding: 0.5rem 1rem; border: 1px solid #e5e7eb; border-radius: 8px; background: white; cursor: pointer; font-size: 0.9rem; }
.map-tab.active { background: #0f5132; color: white; border-color: #0f5132; }
.map-panel { min-height: 500px; }
</style>
