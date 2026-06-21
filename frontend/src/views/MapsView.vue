<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppHeader from '@/components/AppHeader.vue';
import AppFooter from '@/components/AppFooter.vue';
import { api } from '@/composables/api';
import { loadGoogleMaps, UgandaGeoMap } from '@/composables/googleMaps';
import { buildChoroplethOptions, loadUgandaMap, useCharts } from '@/composables/highcharts';

const { t } = useI18n();
const { mapChart } = useCharts();

const HIDDEN_LAYERS = ref(new Set(['farm-clusters']));

const layers = ref([]);
const activeLayer = ref('districts');
const metric = ref('compliance_rate');
const mapTitle = ref('');
const googleMapEl = ref(null);
const hcMapEl = ref(null);
const fallbackMapEl = ref(null);
const mapError = ref('');
const mapNotice = ref('');
const loading = ref(true);
const googleMapsKey = ref(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '');
const showDistrictPanel = ref(true);
let geoMap = null;
let hcMapInstance = null;
let fallbackMapInstance = null;

const LAYER_CONFIG = {
  districts: { metric: 'compliance_rate', min: 60, max: 100, colors: ['#fee2e2', '#1a7f37'], titleKey: 'maps.districtCompliance', showDistrictLabels: true },
  regions: { metric: 'compliance_rate', min: 80, max: 95, colors: ['#dbeafe', '#1a73e8'], titleKey: 'maps.regionalOverview', showDistrictLabels: false },
  'coffee-belt': { metric: 'production_tons', min: 0, max: 60000, colors: ['#f5f0eb', '#6f4e37'], titleKey: 'maps.coffeeBelt', showDistrictLabels: false },
  'risk-zones': { metric: 'risk_score', min: 0, max: 100, colors: ['#d1fae5', '#d93025'], titleKey: 'maps.riskZones', showDistrictLabels: false },
};

async function loadLayers() {
  const res = await api('/api/geo/layers');
  layers.value = (res.layers || []).filter((layer) => !HIDDEN_LAYERS.value.has(layer.id));
  if (layers.value.length && !layers.value.find((l) => l.id === activeLayer.value)) {
    activeLayer.value = layers.value[0].id;
  }
}

async function renderHighchartsMap(el, geo, cfg, { districtLabels = false } = {}) {
  if (!el) return null;
  await loadUgandaMap();
  await nextTick();
  return mapChart(el, buildChoroplethOptions(geo, {
    layerId: activeLayer.value,
    min: cfg.min,
    max: cfg.max,
    minColor: cfg.colors[0],
    maxColor: cfg.colors[1],
    valueKey: metric.value || cfg.metric,
    seriesName: t(`maps.metrics.${metric.value || cfg.metric}`),
    showDistrictLabels: districtLabels,
  }));
}

async function renderHighchartsDistrictMap(geo, cfg) {
  if (hcMapInstance) {
    hcMapInstance.destroy();
    hcMapInstance = null;
  }
  if (activeLayer.value !== 'districts' || !googleMapsKey.value) return;
  hcMapInstance = await renderHighchartsMap(hcMapEl.value, geo, cfg, { districtLabels: true });
}

async function renderFallbackHighchartsMap(geo, cfg) {
  if (fallbackMapInstance) {
    fallbackMapInstance.destroy();
    fallbackMapInstance = null;
  }
  if (googleMapsKey.value) return;
  fallbackMapInstance = await renderHighchartsMap(fallbackMapEl.value, geo, cfg, {
    districtLabels: activeLayer.value === 'districts',
  });
}

async function renderMap() {
  mapError.value = '';
  mapNotice.value = '';
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

    await nextTick();

    if (googleMapsKey.value) {
      const maps = await loadGoogleMaps(googleMapsKey.value);
      if (!geoMap && googleMapEl.value) {
        geoMap = new UgandaGeoMap(googleMapEl.value, maps);
      }
      if (geoMap) {
        geoMap.renderGeoJson(geo, {
          min: cfg.min,
          max: cfg.max,
          minColor: cfg.colors[0],
          maxColor: cfg.colors[1],
          valueKey: metric.value || cfg.metric,
          metricLabel: t(`maps.metrics.${metric.value || cfg.metric}`),
          showDistrictLabels: !!cfg.showDistrictLabels,
        });
      }
    } else {
      mapNotice.value = 'Google Maps API key not set. Showing Highcharts map. Set GOOGLE_MAPS_API_KEY on the server.';
      await renderFallbackHighchartsMap(geo, cfg);
    }

    await renderHighchartsDistrictMap(geo, cfg);
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
  geoMap?.destroy();
  geoMap = null;
  if (hcMapInstance) {
    hcMapInstance.destroy();
    hcMapInstance = null;
  }
  if (fallbackMapInstance) {
    fallbackMapInstance.destroy();
    fallbackMapInstance = null;
  }
});

onMounted(async () => {
  try {
    const cfg = await api('/api/auth/config');
    const maps = cfg.google_maps || {};
    if (maps.api_key) {
      googleMapsKey.value = maps.api_key;
    } else if (maps.enabled === false) {
      googleMapsKey.value = '';
    }
    if (Array.isArray(maps.hidden_layer_ids)) {
      HIDDEN_LAYERS.value = new Set(maps.hidden_layer_ids);
    }
    if (maps.default_metric) {
      metric.value = maps.default_metric;
    }
    if (maps.default_layer) {
      activeLayer.value = maps.default_layer;
    }
    showDistrictPanel.value = maps.show_highcharts_district_panel !== false;
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
      <p v-if="mapNotice" class="form-msg" style="margin-bottom:0.75rem">{{ mapNotice }}</p>
      <p v-if="mapError" class="form-msg error">{{ mapError }}</p>
      <div v-show="googleMapsKey" ref="googleMapEl" class="google-map-canvas" />
      <div v-show="!googleMapsKey" ref="fallbackMapEl" class="google-map-canvas" />
    </div>

    <div v-if="activeLayer === 'districts' && showDistrictPanel" class="chart-box map-panel hc-district-panel">
      <h3>District boundaries with names (Highcharts)</h3>
      <p class="map-panel-note">District labels are shown on both Google Maps and this choropleth view.</p>
      <div ref="hcMapEl" class="hc-map-canvas" />
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
.google-map-canvas { height: 480px; width: 100%; border-radius: 12px; overflow: hidden; }
.hc-district-panel { margin-top: 1.5rem; }
.hc-map-canvas { height: 420px; width: 100%; }
.map-panel-note { font-size: 0.88rem; color: var(--muted); margin: 0.35rem 0 0.75rem; }
</style>
